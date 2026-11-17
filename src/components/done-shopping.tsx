import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShoppingItem } from "@/lib/api";
import { formatAmount, parseAmount } from "@/lib/units";

type Choice = { amount: string; keep: boolean };

/** A count can be stepped; text amounts like "3ish" are just kept or skipped. */
const numeric = (amount: string) => parseAmount(amount);

const step = (amount: string, delta: number) => {
  const value = numeric(amount);
  if (value === null) return amount;
  const next = delta < 0 && value < 1 ? 0 : Math.max(0, value + delta);
  return formatAmount(next);
};

function DoneShopping({
  items,
  pending,
  onCancel,
  onSave,
}: {
  items: ShoppingItem[];
  pending: boolean;
  onCancel: () => void;
  onSave: (keep: { id: string; amount: string; unit: string }[]) => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { amount: item.amount, keep: true }])
    )
  );

  const set = (id: string, patch: Partial<Choice>) =>
    setChoices((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { amount: "", keep: true }), ...patch },
    }));

  const keeping = items.filter((item) => {
    const choice = choices[item.id];
    return choice?.keep && numeric(choice.amount) !== 0;
  });

  const save = () =>
    onSave(
      keeping.map((item) => ({
        id: item.id,
        amount: choices[item.id]?.amount ?? item.amount,
        unit: item.unit,
      }))
    );

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Done shopping</DialogTitle>
          <DialogDescription>
            How much goes in the pantry? Set tonight's dinner to 0.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-1 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              setChoices(
                Object.fromEntries(
                  items.map((item) => [
                    item.id,
                    { amount: item.amount, keep: true },
                  ])
                )
              )
            }
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() =>
              setChoices(
                Object.fromEntries(
                  items.map((item) => [
                    item.id,
                    { amount: item.amount, keep: false },
                  ])
                )
              )
            }
          >
            None
          </Button>
        </div>
        <ul className="-mt-2 divide-y rounded-xl ring-1 ring-foreground/10">
          {items.map((item) => {
            const choice = choices[item.id] ?? {
              amount: item.amount,
              keep: true,
            };
            const value = numeric(choice.amount);
            const off = !choice.keep || value === 0;
            return (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    off && "text-muted-foreground line-through"
                  )}
                >
                  {item.name}
                </span>
                {value !== null ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Less ${item.name}`}
                      disabled={off}
                      onClick={() =>
                        set(item.id, {
                          amount: step(choice.amount, -1),
                          keep: true,
                        })
                      }
                    >
                      <MinusIcon />
                    </Button>
                    <span
                      className="w-16 text-center text-sm tabular-nums"
                      aria-live="polite"
                    >
                      {choice.keep ? choice.amount : "0"}
                      {item.unit && (
                        <span className="text-muted-foreground">
                          {" "}
                          {item.unit}
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`More ${item.name}`}
                      onClick={() =>
                        set(item.id, {
                          amount: choice.keep
                            ? step(choice.amount, 1)
                            : step("0", 1),
                          keep: true,
                        })
                      }
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant={choice.keep ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={choice.keep}
                    onClick={() => set(item.id, { keep: !choice.keep })}
                  >
                    {choice.keep
                      ? `Keep${item.amount || item.unit ? ` ${[item.amount, item.unit].filter(Boolean).join(" ")}` : ""}`
                      : "Skip"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending
              ? "Saving"
              : keeping.length
                ? `Add ${keeping.length} to pantry`
                : "Clear without adding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DoneShopping };
