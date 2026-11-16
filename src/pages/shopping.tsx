import { CheckIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type SubmitEvent } from "react";
import { Link } from "react-router";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addShoppingItem,
  clearShopping,
  listShopping,
  removeShoppingItem,
  updateShoppingItem,
  type ShoppingItem,
} from "@/lib/api";
import { easeOut } from "@/lib/motion";
import { useTitle } from "@/lib/use-title";
import { parenthetical } from "@/lib/view";

const quantity = (item: ShoppingItem) =>
  [item.amount, item.unit].filter(Boolean).join(" ");

function Row({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: easeOut }}
      className="flex items-center gap-1 rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            item.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input"
          )}
          aria-hidden="true"
        >
          {item.checked && <CheckIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-base leading-6",
              item.checked && "text-muted-foreground line-through"
            )}
          >
            {quantity(item) && (
              <span className="font-medium tabular-nums">{quantity(item)} </span>
            )}
            {item.name}
            {item.note && (
              <span className="text-muted-foreground"> {parenthetical(item.note)}</span>
            )}
          </span>
          {item.sources.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {item.sources.join(", ")}
            </span>
          )}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-2 shrink-0"
        aria-label={`Remove ${item.name}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </motion.li>
  );
}

function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  useTitle("Shopping list · Mise");

  useEffect(() => {
    let active = true;
    const load = () =>
      listShopping().then((result) => {
        if (!active) return;
        if (result.ok) {
          setItems(result.value);
          setError(null);
        } else setError(result.error);
      });
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const apply = (
    result: { ok: true; value: ShoppingItem[] } | { ok: false; error: string }
  ) => {
    if (result.ok) setItems(result.value);
    else toast.error(result.error);
    return result.ok;
  };

  const add = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    const match = text.match(/^(\d+(?:[./]\d+)?)\s+(.+)$/);
    const ok = apply(
      await addShoppingItem(
        match ? { amount: match[1] ?? "", name: match[2] ?? text } : { name: text }
      )
    );
    setAdding(false);
    if (ok) setDraft("");
  };

  const toggle = async (item: ShoppingItem) => {
    setItems((current) =>
      current?.map((entry) =>
        entry.id === item.id ? { ...entry, checked: !entry.checked } : entry
      ) ?? current
    );
    const result = await updateShoppingItem(item.id, { checked: !item.checked });
    if (!apply(result))
      setItems((current) =>
        current?.map((entry) =>
          entry.id === item.id ? { ...entry, checked: item.checked } : entry
        ) ?? current
      );
  };

  const remove = async (item: ShoppingItem) => {
    setItems((current) => current?.filter((entry) => entry.id !== item.id) ?? current);
    apply(await removeShoppingItem(item.id));
  };

  const open = (items ?? []).filter((item) => !item.checked);
  const done = (items ?? []).filter((item) => item.checked);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">Shopping list</h1>
          <p className="text-sm text-muted-foreground">
            {items === null
              ? "Loading"
              : open.length === 0
                ? done.length
                  ? "Everything is in the basket"
                  : "Nothing to buy yet"
                : `${open.length} to buy`}
          </p>
        </div>
        {items && items.length > 0 && (
          <div className="flex gap-2">
            {done.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => apply(await clearShopping("checked"))}
              >
                <CheckIcon data-icon="inline-start" />
                Clear checked
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmClear(true)}
            >
              <TrashIcon data-icon="inline-start" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <Input
          value={draft}
          maxLength={200}
          placeholder="Add an item, like 2 lemons"
          aria-label="New item"
          className="h-10 text-base"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="lg" className="h-10" disabled={adding || !draft.trim()}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {items && items.length === 0 && (
        <div className="space-y-3 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <h2 className="text-base font-medium">Your list is empty</h2>
          <p className="text-sm text-muted-foreground">
            Add items above, or use “Shopping list” on a recipe or on this
            week’s meal plan. Matching ingredients are added together.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/">Browse recipes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/plan">Meal plan</Link>
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {open.map((item) => (
            <Row
              key={item.id}
              item={item}
              onToggle={() => toggle(item)}
              onRemove={() => remove(item)}
            />
          ))}
        </AnimatePresence>
      </ul>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">In the basket</h2>
          <ul className="space-y-2 opacity-80">
            <AnimatePresence initial={false}>
              {done.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={() => toggle(item)}
                  onRemove={() => remove(item)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear the whole list?</DialogTitle>
            <DialogDescription>
              This removes every item, checked or not.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (apply(await clearShopping("all"))) setConfirmClear(false);
              }}
            >
              Clear all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { ShoppingPage };
