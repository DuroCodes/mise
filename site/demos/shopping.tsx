import { CheckIcon, StoreIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "cn";
import { easeOut } from "@/lib/motion";
import { aisleFor } from "@/shared/aisles";
import { fullLayout, sectionTitle, type StoreSection } from "@/shared/stores";
import { stores, type ListItem } from "../demo-data";

type Grouping = "aisle" | "recipe";

const quantity = (item: ListItem) =>
  [item.amount, item.unit].filter(Boolean).join(" ");

/** the same grouping the shopping page does (src/pages/shopping.tsx). */
const groupItems = (
  items: ListItem[],
  grouping: Grouping,
  layout: StoreSection[]
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

function Row({
  item,
  checked,
  showSources,
  onToggle,
}: {
  item: ListItem;
  checked: boolean;
  showSources: boolean;
  onToggle: () => void;
}) {
  const measure = quantity(item);
  const details = showSources ? item.sources.join(", ") : "";

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex min-h-12 w-full min-w-0 items-center gap-3 py-2 pr-3 pl-3 text-left outline-none focus-visible:bg-muted/60 sm:pl-4"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input"
          )}
          aria-hidden="true"
        >
          {checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 text-[0.95rem] leading-6 sm:flex-row sm:items-baseline sm:gap-x-3",
            checked && "text-muted-foreground line-through"
          )}
        >
          <span className="min-w-0 truncate sm:flex-1">
            {measure && (
              <span className="font-medium tabular-nums">{measure} </span>
            )}
            <span>{item.name}</span>
          </span>
          {details && (
            <span className="truncate text-xs text-muted-foreground no-underline sm:max-w-[42%] sm:shrink-0 sm:text-right">
              {details}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

const groupHeading =
  "flex items-baseline gap-2 px-1 text-sm font-medium text-muted-foreground";

/** the shopping list: real merging, real aisle sorting, nothing saved. */
function ShoppingDemo({ items }: { items: ListItem[] }) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [storeId, setStoreId] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("aisle");

  const open = items.filter((item) => !checked.has(item.id));
  const done = items.filter((item) => checked.has(item.id));
  const store = stores.find((entry) => entry.id === storeId) ?? null;
  const groups = groupItems(open, grouping, store?.layout ?? []);

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  return (
    <div className="flex max-h-[38rem] flex-col">
      <div className="space-y-3 border-b px-4 pt-4 pb-3">
        <div className="space-y-1">
          <p className="text-lg font-medium tracking-tight">Shopping list</p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {!open.length
              ? "Everything is in the basket"
              : `${open.length} to buy${done.length ? ` · ${done.length} in the basket` : ""}`}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-input pr-1 pl-2.5 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
            <StoreIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="sr-only">Store</span>
            <select
              className="min-w-0 bg-transparent outline-none"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                if (event.target.value) setGrouping("aisle");
              }}
            >
              <option value="">Usual store order</option>
              {stores.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
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
        className="quiet-scroll flex-1 space-y-4 overflow-y-auto p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
        tabIndex={0}
        role="group"
        aria-label="Items"
      >
        {groups.map((group) => (
          <section key={group.name} className="space-y-1.5">
            <h3 className={groupHeading}>
              {group.name}
              <span className="font-normal tabular-nums">
                {group.items.length}
              </span>
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {group.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  checked={false}
                  showSources={grouping === "aisle" || item.sources.length > 1}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          </section>
        ))}
        {done.length > 0 && (
          <section className="space-y-1.5">
            <h3 className={groupHeading}>
              In the basket
              <span className="font-normal tabular-nums">{done.length}</span>
            </h3>
            <ul className="divide-y overflow-hidden rounded-xl bg-card/60 ring-1 ring-foreground/10">
              {done.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  checked
                  showSources={false}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export { ShoppingDemo };
