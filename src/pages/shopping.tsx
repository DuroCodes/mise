import {
  CheckIcon,
  CloudOffIcon,
  CopyIcon,
  PackageOpenIcon,
  PlusIcon,
  ScanLineIcon,
  Share2Icon,
  ShoppingBasketIcon,
  StoreIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "cn";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { DoneShopping } from "@/components/done-shopping";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearShopping,
  finishShopping,
  listShopping,
  listStores,
  type ShoppingItem,
} from "@/lib/api";
import { easeOut } from "@/lib/motion";
import {
  flush,
  onOutboxChange,
  outboxFor,
  pendingCount,
  send,
  withOutbox,
  type Op,
} from "@/lib/outbox";
import { useSession } from "@/lib/session-context";
import { useTitle } from "@/lib/use-title";
import { aisleFor } from "@/shared/aisles";
import {
  fullLayout,
  sectionTitle,
  type Store,
  type StoreSection,
} from "@/shared/stores";
import { ListSkeleton } from "@/components/ui/skeleton";

type Grouping = "aisle" | "recipe";
type Group = { name: string; items: ShoppingItem[] };

const groupingKey = "mise-shopping-group";
const storeKey = "mise-shopping-store";

const readStoreId = () => {
  try {
    return localStorage.getItem(storeKey) ?? "";
  } catch {
    return "";
  }
};

const saveStoreId = (id: string) => {
  try {
    if (id) localStorage.setItem(storeKey, id);
    else localStorage.removeItem(storeKey);
  } catch {
    // the choice still applies until the page reloads.
  }
};

const readGrouping = () => {
  try {
    return localStorage.getItem(groupingKey) === "recipe" ? "recipe" : "aisle";
  } catch {
    return "aisle";
  }
};

const saveGrouping = (value: Grouping) => {
  try {
    localStorage.setItem(groupingKey, value);
  } catch {
    // the choice still applies until the page reloads.
  }
};

const quantity = (item: ShoppingItem) =>
  [item.amount, item.unit].filter(Boolean).join(" ");

const isOptional = (note: string) => /\boptional\b/i.test(note);

/** the note without the word "optional", which gets its own tag. */
const cleanNote = (note: string) =>
  note
    .replace(/\(?\boptional\b\)?[,;:]?\s*/i, "")
    .replace(/^[\s,;:()-]+|[\s,;:()]+$/g, "")
    .trim();

const label = (item: ShoppingItem) =>
  [quantity(item), item.name].filter(Boolean).join(" ");

const groupItems = (
  items: ShoppingItem[],
  grouping: Grouping,
  layout: StoreSection[]
) => {
  if (grouping === "aisle") {
    const byAisle = new Map<string, ShoppingItem[]>();
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
  const byRecipe = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const source = item.sources[0] ?? "Added by hand";
    byRecipe.set(source, [...(byRecipe.get(source) ?? []), item]);
  }
  return [...byRecipe.entries()]
    .sort(([a], [b]) =>
      a === "Added by hand"
        ? 1
        : b === "Added by hand"
          ? -1
          : a.localeCompare(b)
    )
    .map(([name, list]) => ({ name, items: list }));
};

const asText = (groups: Group[]) =>
  [
    "Shopping list",
    ...groups.map(
      (group) =>
        `\n${group.name}\n${group.items
          .map((item) => {
            const note = cleanNote(item.note);
            const extra = [isOptional(item.note) ? "optional" : "", note]
              .filter(Boolean)
              .join(", ");
            return `- ${label(item)}${extra ? ` (${extra})` : ""}`;
          })
          .join("\n")}`
    ),
  ].join("\n");

// removals wait a few seconds so they can be undone; this survives leaving the page.
const pendingRemovals = new Map<string, number>();

function Row({
  item,
  showSources,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  showSources: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const optional = isOptional(item.note);
  const note = cleanNote(item.note);
  const details = [note, showSources ? item.sources.join(", ") : ""].filter(
    Boolean
  );

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="flex items-center"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pr-1 pl-3 text-left outline-none focus-visible:bg-muted/60 sm:pl-4"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            item.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input"
          )}
          aria-hidden="true"
        >
          {item.checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex flex-wrap items-baseline gap-x-1.5 text-[0.95rem] leading-6",
              item.checked && "text-muted-foreground line-through"
            )}
          >
            {quantity(item) && (
              <span className="font-medium tabular-nums">{quantity(item)}</span>
            )}
            <span>{item.name}</span>
            {optional && (
              <span className="rounded-full bg-muted px-1.5 text-[0.7rem] leading-5 font-medium text-muted-foreground no-underline">
                optional
              </span>
            )}
          </span>
          {details.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {details.join(" · ")}
            </span>
          )}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mr-1.5 shrink-0 text-muted-foreground sm:mr-2"
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
  const [grouping, setGrouping] = useState<Grouping>(readGrouping);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState(readStoreId);
  const [scanning, setScanning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [savingDone, setSavingDone] = useState(false);
  const [waiting, setWaiting] = useState(pendingCount);
  const [params, setParams] = useSearchParams();
  const { account, offline } = useSession();
  outboxFor(account.id);
  const navigate = useNavigate();
  useTitle("Shopping list · Mise");

  useEffect(() => {
    let active = true;
    listStores().then((result) => {
      if (active && result.ok) setStores(result.value);
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = (list: ShoppingItem[]) =>
    withOutbox(list).filter((item) => !pendingRemovals.has(item.id));

  const load = async () => {
    const result = await listShopping();
    if (result.ok) {
      setItems(visible(result.value));
      setError(null);
    } else if (items === null) setError(result.error);
  };

  // send waiting offline changes, then refresh, whenever the connection comes back.
  const sync = async () => {
    if (pendingCount() > 0) await flush();
    await load();
  };

  useEffect(() => {
    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const stop = onOutboxChange(setWaiting);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      stop();
    };
    // runs once; sync reads the latest state when it's called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.get("scan") !== "1") return;
    setScanning(true);
    const next = new URLSearchParams(params);
    next.delete("scan");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const apply = (
    result: { ok: true; value: ShoppingItem[] } | { ok: false; error: string }
  ) => {
    if (result.ok) setItems(visible(result.value));
    else toast.error(result.error);
    return result.ok;
  };

  /** applies a change here right away, then sends it (or keeps it for later). */
  const change = async (
    op: Op,
    local: (list: ShoppingItem[]) => ShoppingItem[]
  ) => {
    setItems((current) => (current ? local(current) : current));
    const result = await send(op);
    if (result.queued) return true;
    if (!result.ok) {
      toast.error("Couldn't save that change");
      await load();
      return false;
    }
    if (result.list) setItems(visible(result.list));
    return true;
  };

  const add = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    const match = text.match(/^(\d+(?:[./]\d+)?)\s+(.+)$/);
    const name = (match ? match[2] : text)?.trim() ?? text;
    const amount = match?.[1] ?? "";
    const tempId = `local-${crypto.randomUUID()}`;
    const ok = await change(
      { kind: "add", tempId, name, amount, checked: false },
      (list) => [
        ...list,
        {
          id: tempId,
          name,
          amount,
          unit: "",
          note: "",
          sources: [],
          checked: false,
        },
      ]
    );
    setAdding(false);
    if (ok) setDraft("");
  };

  const toggle = (item: ShoppingItem) =>
    change({ kind: "check", id: item.id, checked: !item.checked }, (list) =>
      list.map((entry) =>
        entry.id === item.id ? { ...entry, checked: !item.checked } : entry
      )
    );

  const remove = (item: ShoppingItem) => {
    setItems(
      (current) => current?.filter((entry) => entry.id !== item.id) ?? current
    );
    const timer = window.setTimeout(() => {
      pendingRemovals.delete(item.id);
      void send({ kind: "remove", id: item.id });
    }, 5000);
    pendingRemovals.set(item.id, timer);
    toast(`Removed ${item.name}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingRemovals.get(item.id);
          if (pending === undefined) return;
          window.clearTimeout(pending);
          pendingRemovals.delete(item.id);
          setItems((current) =>
            current && !current.some((entry) => entry.id === item.id)
              ? [...current, item]
              : current
          );
        },
      },
    });
  };

  const finish = async (
    keep: { id: string; amount: string; unit: string }[]
  ) => {
    setSavingDone(true);
    const result = await finishShopping(keep);
    setSavingDone(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFinishing(false);
    setItems(
      result.value.shopping.filter((item) => !pendingRemovals.has(item.id))
    );
    if (result.value.kept > 0)
      toast.success(
        `Added ${result.value.kept} ${result.value.kept === 1 ? "item" : "items"} to your pantry`,
        { action: { label: "View", onClick: () => navigate("/pantry") } }
      );
    else toast.success("Cleared your basket");
  };

  // from the scanner: check an item off (never un-check it).
  const checkOff = (item: ShoppingItem) => {
    if (item.checked) return;
    void toggle(item);
  };

  const addScanned = async (name: string) => {
    const tempId = `local-${crypto.randomUUID()}`;
    await change(
      { kind: "add", tempId, name, amount: "", checked: true },
      (list) => [
        ...list,
        {
          id: tempId,
          name,
          amount: "",
          unit: "",
          note: "",
          sources: [],
          checked: true,
        },
      ]
    );
    if (pendingCount() === 0) await load();
  };

  // finishing needs the server, so send any offline changes first.
  const openFinish = async () => {
    if (pendingCount() > 0 && !(await flush())) {
      toast.error("You're offline. Finish once you're back online.");
      return;
    }
    await load();
    setFinishing(true);
  };

  const chooseGrouping = (value: Grouping) => {
    setGrouping(value);
    saveGrouping(value);
  };

  const open = (items ?? []).filter((item) => !item.checked);
  const done = (items ?? []).filter((item) => item.checked);
  const total = open.length + done.length;
  const store = stores.find((entry) => entry.id === storeId) ?? null;
  const groups = groupItems(open, grouping, store?.layout ?? []);

  const chooseStore = (value: string) => {
    if (value === "__manage") {
      navigate("/stores");
      return;
    }
    setStoreId(value);
    saveStoreId(value);
    if (value && grouping !== "aisle") chooseGrouping("aisle");
  };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const shareList = async () => {
    const text = asText(groups);
    if (canShare) {
      try {
        await navigator.share({ title: "Shopping list", text });
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("List copied");
    } catch {
      toast.error("Could not copy the list");
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium tracking-tight">
              Shopping list
            </h1>
            <p className="text-sm text-muted-foreground">
              {items === null
                ? "Loading"
                : total === 0
                  ? "Nothing to buy yet"
                  : open.length === 0
                    ? "Everything is in the basket"
                    : `${open.length} to buy${done.length ? ` · ${done.length} in the basket` : ""}`}
            </p>
          </div>
          {total > 0 && (
            <div className="flex flex-wrap gap-2">
              {open.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScanning(true)}
                >
                  <ScanLineIcon data-icon="inline-start" />
                  Scan
                </Button>
              )}
              {open.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void shareList()}
                >
                  {canShare ? (
                    <Share2Icon data-icon="inline-start" />
                  ) : (
                    <CopyIcon data-icon="inline-start" />
                  )}
                  {canShare ? "Share" : "Copy"}
                </Button>
              )}
              {done.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openFinish()}
                >
                  <CheckIcon data-icon="inline-start" />
                  Done shopping
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
        {total > 0 && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Items in the basket"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done.length}
          >
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={false}
              animate={{ width: `${(done.length / total) * 100}%` }}
              transition={{ duration: 0.3, ease: easeOut }}
            />
          </div>
        )}
      </div>

      {(offline || waiting > 0) && (
        <p
          className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <CloudOffIcon className="size-4 shrink-0" aria-hidden="true" />
          {offline ? "Offline. Changes save here" : "Waiting to sync"}
          {waiting > 0 && ` · ${waiting} waiting`}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <Input
          value={draft}
          maxLength={200}
          placeholder="Add an item, like 2 lemons"
          aria-label="New item"
          className="h-10 text-base"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          className="h-10"
          disabled={adding || !draft.trim()}
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {items === null && !error && (
        <ListSkeleton label="Loading your list" rows={6} />
      )}

      {items && total === 0 && (
        <div className="space-y-2 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <ShoppingBasketIcon
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-base font-medium">Your list is empty</h2>
          <p className="text-sm text-muted-foreground">
            Add items above, or send them from a recipe or the meal plan.
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

      {open.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            value={store ? store.id : "usual"}
            onValueChange={(value) =>
              chooseStore(value === "usual" ? "" : value)
            }
          >
            <SelectTrigger aria-label="Store" className="max-w-56">
              <StoreIcon className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usual">Usual store order</SelectItem>
              {stores.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
              ))}
              <SelectItem value="__manage">
                {stores.length ? "Edit my stores…" : "Set up my stores…"}
              </SelectItem>
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
                onClick={() => chooseGrouping(value)}
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
      )}

      {groups.map((group) => (
        <section key={group.name} className="space-y-1.5">
          <h2 className="flex items-baseline gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.name}
            <span className="font-normal tabular-nums">
              {group.items.length}
            </span>
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <AnimatePresence initial={false}>
              {group.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  showSources={grouping === "aisle" || item.sources.length > 1}
                  onToggle={() => void toggle(item)}
                  onRemove={() => remove(item)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}

      {done.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-baseline gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              In the basket
              <span className="font-normal tabular-nums">{done.length}</span>
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void openFinish()}
            >
              <PackageOpenIcon data-icon="inline-start" />
              Done shopping
            </Button>
          </div>
          <ul className="divide-y overflow-hidden rounded-xl bg-card/60 ring-1 ring-foreground/10">
            <AnimatePresence initial={false}>
              {done.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  showSources={false}
                  onToggle={() => void toggle(item)}
                  onRemove={() => remove(item)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {scanning && (
        <BarcodeScanner
          items={items ?? []}
          onClose={() => setScanning(false)}
          onCheck={checkOff}
          onAdd={addScanned}
        />
      )}

      {finishing && done.length > 0 && (
        <DoneShopping
          items={done}
          pending={savingDone}
          onCancel={() => setFinishing(false)}
          onSave={(keep) => void finish(keep)}
        />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmClear(false)}
            >
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
