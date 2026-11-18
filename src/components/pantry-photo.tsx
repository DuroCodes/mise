import { CameraIcon, CheckIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addPantryBatch,
  readPantryPhoto,
  type PantryItem,
  type PhotoItem,
} from "@/lib/api";
import { shrinkPhoto } from "@/lib/images";

type Row = PhotoItem & { keep: boolean };

/** snap a receipt or the fridge; Claude lists the food, you check it, it goes in the pantry. */
function PantryPhoto({ onAdded }: { onAdded: (items: PantryItem[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"receipt" | "fridge">("receipt");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRows(null);
    setError(null);
    setReading(false);
  };

  const read = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    const photo = await shrinkPhoto(file);
    const result = await readPantryPhoto(photo, kind);
    setReading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows(result.value.map((item) => ({ ...item, keep: true })));
  };

  const save = async () => {
    const items = (rows ?? []).filter((row) => row.keep && row.name.trim());
    if (items.length === 0) return;
    setSaving(true);
    const result = await addPantryBatch(
      items.map(({ name, amount, unit }) => ({
        name: name.trim(),
        amount: amount.trim(),
        unit: unit.trim(),
      }))
    );
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onAdded(result.value);
    toast.success(
      `Added ${items.length} ${items.length === 1 ? "item" : "items"}`
    );
    setOpen(false);
    reset();
  };

  const keeping = (rows ?? []).filter((row) => row.keep).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reading || saving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10">
          <CameraIcon data-icon="inline-start" />
          From a photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add from a photo</DialogTitle>
          <DialogDescription>
            The model reads it; you check the list. Sent only when you use this.
          </DialogDescription>
        </DialogHeader>

        {rows === null ? (
          <div className="space-y-4">
            <div
              className="flex rounded-lg bg-muted p-0.5"
              role="radiogroup"
              aria-label="Photo of"
            >
              {(
                [
                  ["receipt", "Receipt"],
                  ["fridge", "Fridge or shelf"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    kind === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="lg"
              className="h-12 w-full"
              disabled={reading}
              onClick={() => input.current?.click()}
            >
              <CameraIcon data-icon="inline-start" />
              {reading ? "Reading…" : "Take a photo"}
            </Button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                void read(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <ul className="max-h-[50svh] divide-y overflow-y-auto rounded-xl ring-1 ring-foreground/10">
            {rows.map((row, index) => (
              <li
                key={`${row.name}-${index}`}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={row.keep}
                  aria-label={`Add ${row.name}`}
                  onClick={() =>
                    setRows(
                      rows.map((entry, at) =>
                        at === index ? { ...entry, keep: !entry.keep } : entry
                      )
                    )
                  }
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border-2",
                    row.keep
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {row.keep && (
                    <CheckIcon className="size-3.5" strokeWidth={3} />
                  )}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    !row.keep && "text-muted-foreground line-through"
                  )}
                >
                  {row.name}
                </span>
                <Input
                  value={row.amount}
                  aria-label={`Amount of ${row.name}`}
                  placeholder="amt"
                  className="h-7 w-14 text-sm"
                  onChange={(event) =>
                    setRows(
                      rows.map((entry, at) =>
                        at === index
                          ? { ...entry, amount: event.target.value }
                          : entry
                      )
                    )
                  }
                />
                <span className="w-12 truncate text-xs text-muted-foreground">
                  {row.unit}
                </span>
              </li>
            ))}
          </ul>
        )}

        {rows !== null && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={reset}
            >
              Retake
            </Button>
            <Button
              type="button"
              disabled={saving || keeping === 0}
              onClick={() => void save()}
            >
              {saving ? "Adding" : `Add ${keeping} to pantry`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { PantryPhoto };
