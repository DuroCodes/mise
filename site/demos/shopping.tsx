import { StoreIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "cn";
import { ShoppingRow } from "@/components/shopping-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { easeOut } from "@/lib/motion";
import { aisleFor } from "@/shared/aisles";
import { fullLayout, sectionTitle, type StoreSection } from "@/shared/stores";
import { STORES, type ListItem } from "../demo-data";

type Grouping = "aisle" | "recipe";

/** the same grouping the shopping page does (src/pages/shopping.tsx). */
const groupItems = (
  items: ListItem[],
  grouping: Grouping,
  layout: readonly StoreSection[]
) => {
  if (grouping === "aisle") {
    const byAisle = new Map<string, ListItem[]>();
    for (const item of items) {
      const aisle = aisleFor(item.name);
      byAisle.set(aisle, [...(byAisle.get(aisle) ?? []), item]);
    }
    return fullLayout(layout)
      .filter((section) => byAisle.has(section.aisle))
      .map((section) => ({
        name: sectionTitle(section),
        items: byAisle.get(section.aisle) ?? [],
      }));
  }
  const byRecipe = new Map<string, ListItem[]>();
  for (const item of items) {
    const source = item.sources[0] ?? "Added by hand";
    byRecipe.set(source, [...(byRecipe.get(source) ?? []), item]);
  }
  return [...byRecipe.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({ name, items: list }));
};

const groupHeading = "px-1 text-sm font-medium text-muted-foreground";

/** the shopping list: real aisle sorting, the app's own row. */
function ShoppingDemo({ items }: { items: ListItem[] }) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [storeId, setStoreId] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("aisle");

  const open = items.filter((item) => !checked.has(item.id));
  const done = items.filter((item) => checked.has(item.id));
  const store = STORES.find((entry) => entry.id === storeId) ?? null;
  const groups = groupItems(open, grouping, store?.layout ?? []);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const asRow = (item: ListItem, isChecked: boolean) => ({
    ...item,
    checked: isChecked,
  });

  return (
    <div className="flex max-h-[38rem] flex-col">
      <div className="space-y-3 border-b px-4 pt-4 pb-3 sm:px-5">
        <div className="space-y-1">
          <p className="text-lg font-medium tracking-tight">Shopping list</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!open.length
              ? "Everything is in the basket"
              : `${open.length} to buy${done.length ? `, ${done.length} in the basket` : ""}`}
          </p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Items in the basket"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done.length}
        >
          <motion.div
            className="h-full rounded-full bg-brand"
            initial={false}
            animate={{ width: `${(done.length / items.length) * 100}%` }}
            transition={{ duration: 0.3, ease: easeOut }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            value={store ? store.id : "usual"}
            onValueChange={(value) => {
              setStoreId(value === "usual" ? "" : value);
              if (value !== "usual") setGrouping("aisle");
            }}
          >
            <SelectTrigger aria-label="Store" className="max-w-56">
              <StoreIcon className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usual">Usual store order</SelectItem>
              {STORES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            className="flex rounded-lg bg-muted p-0.5"
            role="radiogroup"
            aria-label="Group by"
          >
            {(
              [
                ["aisle", "Aisle"],
                ["recipe", "Recipe"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={grouping === value}
                onClick={() => setGrouping(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  grouping === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="quiet-scroll flex-1 space-y-4 overflow-y-auto p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset sm:p-5"
        tabIndex={0}
        role="group"
        aria-label="Items"
      >
        {groups.map((group) => (
          <section key={group.name} className="space-y-1.5">
            <h3 className={groupHeading}>
              {group.name}{" "}
              <span className="font-normal tabular-nums">
                ({group.items.length})
              </span>
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              <AnimatePresence initial={false}>
                {group.items.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={asRow(item, false)}
                    showSources={
                      grouping === "aisle" || item.sources.length > 1
                    }
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
        {done.length > 0 && (
          <section className="space-y-1.5">
            <h3 className={groupHeading}>
              In the basket{" "}
              <span className="font-normal tabular-nums">({done.length})</span>
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl bg-card/60 ring-1 ring-foreground/10">
              <AnimatePresence initial={false}>
                {done.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={asRow(item, true)}
                    showSources={false}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export { ShoppingDemo };
