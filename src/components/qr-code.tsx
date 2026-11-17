import { useEffect, useState } from "react";

/** A scannable QR code for a link. The QR library loads only when one is shown. */
function QrCode({ value, label }: { value: string; label: string }) {
  const [source, setSource] = useState<{ value: string; url: string } | null>(
    null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(value, {
          margin: 1,
          width: 480,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (active) setSource({ value, url });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (failed)
    return (
      <p className="text-sm text-muted-foreground">Couldn't make a QR code.</p>
    );
  const ready = source?.value === value;
  return (
    <div className="flex justify-center">
      {ready ? (
        <img
          src={source.url}
          alt={label}
          className="size-48 rounded-lg bg-white p-2 ring-1 ring-foreground/10"
        />
      ) : (
        <div
          className="size-48 animate-pulse rounded-lg bg-muted"
          aria-label="Making a QR code"
        />
      )}
    </div>
  );
}

export { QrCode };
