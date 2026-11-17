import { CheckIcon, PlusIcon, ScanLineIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { lookupProduct, type ShoppingItem } from "@/lib/api";
import { matchListItem } from "@/shared/pantry";

type Scan = {
  code: string;
  label: string;
  state: "looking" | "checked" | "missing" | "unknown" | "error";
  itemName?: string;
  productName?: string;
};

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

const formats = ["ean_13", "ean_8", "upc_a", "upc_e"];

function BarcodeScanner({
  items,
  onClose,
  onCheck,
  onAdd,
}: {
  items: ShoppingItem[];
  onClose: () => void;
  onCheck: (item: ShoppingItem) => void;
  onAdd: (name: string) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const latestItems = useRef(items);
  const latestCheck = useRef(onCheck);
  const recent = useRef(new Map<string, number>());
  const [scans, setScans] = useState<Scan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latestItems.current = items;
    latestCheck.current = onCheck;
  }, [items, onCheck]);

  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};

    const update = (code: string, patch: Partial<Scan>) =>
      setScans((current) =>
        current.map((scan) =>
          scan.code === code ? { ...scan, ...patch } : scan
        )
      );

    // Each barcode is handled once per session (the camera sees it many times
    // a second); only a failed lookup can be retried, after a short pause.
    const handle = async (code: string) => {
      if (!/^\d{8,14}$/.test(code)) return;
      const last = recent.current.get(code);
      if (last === Infinity || (last !== undefined && Date.now() - last < 3000))
        return;
      recent.current.set(code, Infinity);
      setScans((current) => [
        { code, label: "Looking it up…", state: "looking" },
        ...current.filter((scan) => scan.code !== code).slice(0, 7),
      ]);
      const result = await lookupProduct(code);
      if (stopped) return;
      if (!result.ok) {
        recent.current.set(code, Date.now());
        update(code, { label: result.error, state: "error" });
        return;
      }
      const product = result.value;
      if (!product) {
        update(code, {
          label: "Unknown product. Tap it on your list.",
          state: "unknown",
        });
        return;
      }
      const item = matchListItem(product.name, latestItems.current);
      if (item) {
        latestCheck.current(item);
        try {
          navigator.vibrate?.(40);
        } catch {
          // Not every device vibrates.
        }
        update(code, {
          label: product.name,
          state: "checked",
          itemName: item.name,
        });
        return;
      }
      const already = latestItems.current.find(
        (entry) =>
          entry.checked &&
          matchListItem(product.name, [{ ...entry, checked: false }])
      );
      if (already)
        update(code, {
          label: product.name,
          state: "checked",
          itemName: already.name,
        });
      else
        update(code, {
          label: product.name,
          state: "missing",
          productName: product.name,
        });
    };

    const start = async () => {
      const element = video.current;
      if (!element) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't use the camera here.");
        return;
      }
      const Native = (window as unknown as { BarcodeDetector?: DetectorClass })
        .BarcodeDetector;
      const supported = Native?.getSupportedFormats
        ? await Native.getSupportedFormats().catch(() => [] as string[])
        : [];
      try {
        if (Native && formats.some((format) => supported.includes(format))) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (stopped) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          element.srcObject = stream;
          await element.play();
          setReady(true);
          const detector = new Native({
            formats: formats.filter((format) => supported.includes(format)),
          });
          let busy = false;
          const timer = window.setInterval(async () => {
            if (busy || element.readyState < 2) return;
            busy = true;
            try {
              const found = await detector.detect(element);
              for (const code of found) void handle(code.rawValue);
            } catch {
              // A frame that can't be read; try the next one.
            }
            busy = false;
          }, 250);
          cleanup = () => {
            window.clearInterval(timer);
            stream.getTracks().forEach((track) => track.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            element,
            (result) => {
              if (result) void handle(result.getText());
            }
          );
          if (stopped) {
            controls.stop();
            return;
          }
          setReady(true);
          cleanup = () => controls.stop();
        }
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your browser's site settings."
            : name === "NotFoundError"
              ? "No camera found."
              : "Couldn't start the camera."
        );
      }
    };

    void start();
    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-label="Scan barcodes"
    >
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={video}
          className="size-full object-cover"
          playsInline
          muted
        />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-72 max-w-[80vw] rounded-2xl ring-2 ring-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <p className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-medium">
            <ScanLineIcon className="size-4" aria-hidden="true" />
            {error
              ? "Camera off"
              : ready
                ? "Point at a barcode"
                : "Starting camera…"}
          </p>
          <Button
            type="button"
            size="icon"
            className="rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Close scanner"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="max-w-xs text-sm">{error}</p>
          </div>
        )}
      </div>
      <div
        className="max-h-[40svh] space-y-2 overflow-y-auto bg-neutral-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
      >
        {scans.length === 0 ? (
          <p className="py-2 text-center text-sm text-white/60">
            Scanned items get checked off your list.
          </p>
        ) : (
          scans.map((scan) => (
            <div
              key={scan.code}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                scan.state === "checked" ? "bg-emerald-500/15" : "bg-white/8"
              )}
            >
              {scan.state === "checked" ? (
                <CheckIcon
                  className="size-4 shrink-0 text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <ScanLineIcon
                  className="size-4 shrink-0 text-white/50"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {scan.state === "checked"
                    ? `Checked off ${scan.itemName}`
                    : scan.label}
                </p>
                {scan.state === "checked" && (
                  <p className="truncate text-xs text-white/50">{scan.label}</p>
                )}
                {scan.state === "missing" && (
                  <p className="text-xs text-white/50">Not on your list</p>
                )}
              </div>
              {scan.state === "missing" && scan.productName && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-white text-black hover:bg-white/90"
                  onClick={async () => {
                    const name = scan.productName ?? "";
                    setScans((current) =>
                      current.map((entry) =>
                        entry.code === scan.code
                          ? { ...entry, state: "checked", itemName: name }
                          : entry
                      )
                    );
                    await onAdd(name);
                  }}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              )}
            </div>
          ))
        )}
        <Button
          type="button"
          className="w-full bg-white text-black hover:bg-white/90"
          onClick={onClose}
        >
          Done scanning
        </Button>
      </div>
    </div>
  );
}

export { BarcodeScanner };
