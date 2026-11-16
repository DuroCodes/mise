import {
  ExternalLinkIcon,
  PackageOpenIcon,
  PencilIcon,
  PlusIcon,
  ShoppingBasketIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMissingToShopping,
  addPantryItem,
  findRecipesWithClaude,
  listPantry,
  pantrySuggestions,
  removePantryItem,
  updatePantryItem,
  type FoundRecipe,
  type PantryItem,
  type PantrySuggestion,
} from "@/lib/api";
import { formatMinutes, totalMinutes } from "@/lib/format";
import { easeOut } from "@/lib/motion";
import { useSession } from "@/lib/session-context";
import { useTitle } from "@/lib/use-title";
import { dayFromKey, localDay, storedMeasure } from "@/lib/view";
import { aisleFor, aisles } from "@/shared/aisles";

const daysUntil = (day: string, today: string) =>
  Math.round((dayFromKey(day).getTime() - dayFromKey(today).getTime()) / 86_400_000);

const expiryLabel = (day: string, today: string) => {
  const days = daysUntil(day, today);
  if (days < 0) return { text: days === -1 ? "expired yesterday" : `expired ${-days} days ago`, tone: "bad" as const };
  if (days === 0) return { text: "use today", tone: "bad" as const };
  if (days === 1) return { text: "use by tomorrow", tone: "soon" as const };
  if (days <= 3) return { text: `use within ${days} days`, tone: "soon" as const };
  return {
    text: `use by ${dayFromKey(day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    tone: "ok" as const,
  };
};

const quantity = (item: { amount: string; unit: string }) =>
  [item.amount, item.unit].filter(Boolean).join(" ");

function EditItem({
  item,
  onClose,
  onSaved,
}: {
  item: PantryItem;
  onClose: () => void;
  onSaved: (items: PantryItem[]) => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount);
  const [unit, setUnit] = useState(item.unit);
  const [note, setNote] = useState(item.note);
  const [expiresOn, setExpiresOn] = useState(item.expiresOn ?? "");
  const [pending, setPending] = useState(false);

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Name the item");
      return;
    }
    setPending(true);
    const result = await updatePantryItem(item.id, {
      name: name.trim(),
      amount: amount.trim(),
      unit: unit.trim(),
      note: note.trim(),
      expiresOn: expiresOn || null,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSaved(result.value);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {item.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pantry-name">Item</Label>
            <Input id="pantry-name" value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pantry-amount">Amount</Label>
              <Input id="pantry-amount" value={amount} maxLength={40} placeholder="2" onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pantry-unit">Unit</Label>
              <Input id="pantry-unit" value={unit} maxLength={40} placeholder="cups" onChange={(event) => setUnit(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pantry-note">Note</Label>
            <Input id="pantry-note" value={note} maxLength={200} placeholder="opened, top shelf…" onChange={(event) => setNote(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pantry-expires">Use by</Label>
            <div className="flex gap-2">
              <Input id="pantry-expires" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
              {expiresOn && (
                <Button type="button" variant="ghost" onClick={() => setExpiresOn("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PantryList({
  items,
  today,
  onItems,
}: {
  items: PantryItem[];
  today: string;
  onItems: (items: PantryItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [expires, setExpires] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PantryItem | null>(null);

  const add = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    const match = text.match(/^(\d+(?:[./]\d+)?)\s+(.+)$/);
    const result = await addPantryItem({
      ...(match ? { amount: match[1] ?? "", name: match[2] ?? text } : { name: text }),
      expiresOn: expires || null,
    });
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onItems(result.value);
    setDraft("");
    setExpires("");
  };

  const remove = async (item: PantryItem) => {
    const result = await removePantryItem(item.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onItems(result.value);
    toast(`Removed ${item.name}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = await addPantryItem({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            note: item.note,
            expiresOn: item.expiresOn,
          });
          if (restored.ok) onItems(restored.value);
          else toast.error(restored.error);
        },
      },
    });
  };

  const soon = items
    .filter((item) => item.expiresOn && daysUntil(item.expiresOn, today) <= 3)
    .sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));

  const groups = aisles
    .map((aisle) => ({
      aisle,
      items: items.filter((item) => aisleFor(item.name) === aisle),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          maxLength={200}
          placeholder="Add something you have, like 6 eggs"
          aria-label="New pantry item"
          className="h-10 text-base"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={expires}
            aria-label="Use by (optional)"
            title="Use by (optional)"
            className="h-10 w-full sm:w-40"
            onChange={(event) => setExpires(event.target.value)}
          />
          <Button type="submit" size="lg" className="h-10" disabled={adding || !draft.trim()}>
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
      </form>

      {soon.length > 0 && (
        <div className="rounded-xl bg-brand/10 px-4 py-3 text-sm ring-1 ring-brand/30">
          <p className="font-medium">Use soon</p>
          <p className="mt-0.5 text-muted-foreground">
            {soon
              .map((item) => `${item.name} (${expiryLabel(item.expiresOn ?? today, today).text})`)
              .join(", ")}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="space-y-2 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <PackageOpenIcon className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-base font-medium">Your pantry is empty</h2>
          <p className="text-sm text-muted-foreground">
            Add what you have above, or tick things off on your shopping list
            and use “Move to pantry”.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.aisle} className="space-y-1.5">
            <h2 className="flex items-baseline gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.aisle}
              <span className="font-normal tabular-nums">{group.items.length}</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {group.items.map((item) => {
                const expiry = item.expiresOn ? expiryLabel(item.expiresOn, today) : null;
                return (
                  <li key={item.id} className="flex items-center gap-1 py-1.5 pr-1.5 pl-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[0.95rem] leading-6">
                        {quantity(item) && <span className="font-medium tabular-nums">{quantity(item)}</span>}
                        <span>{item.name}</span>
                        {expiry && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 text-[0.7rem] leading-5 font-medium",
                              expiry.tone === "bad" && "bg-destructive/15 text-destructive",
                              expiry.tone === "soon" && "bg-brand/15 text-foreground",
                              expiry.tone === "ok" && "bg-muted text-muted-foreground"
                            )}
                          >
                            {expiry.text}
                          </span>
                        )}
                      </p>
                      {item.note && <p className="truncate text-xs text-muted-foreground">{item.note}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
                      <PencilIcon />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Remove ${item.name}`} onClick={() => void remove(item)}>
                      <XIcon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {editing && (
        <EditItem item={editing} onClose={() => setEditing(null)} onSaved={onItems} />
      )}
    </div>
  );
}

function ClaudeFinder({ hasPantry }: { hasPantry: boolean }) {
  const navigate = useNavigate();
  const [focus, setFocus] = useState("");
  const [results, setResults] = useState<FoundRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const search = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasPantry && !focus.trim()) {
      setError("Add a few things to your pantry, or say what you're in the mood for");
      return;
    }
    setPending(true);
    setError(null);
    setResults(null);
    const result = await findRecipesWithClaude(focus);
    setPending(false);
    if (result.ok) setResults(result.value);
    else setError(result.error);
  };

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="space-y-1">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <SparklesIcon className="size-4 text-brand" aria-hidden="true" />
          Find new recipes with Claude
        </h2>
        <p className="text-xs leading-5 text-muted-foreground">
          Claude searches the web for recipes that use what's in your pantry.
          Your pantry list is sent to Anthropic to do this, and a search takes
          about half a minute.
        </p>
      </div>
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={focus}
          maxLength={200}
          placeholder="Anything in particular? Quick, vegetarian, soup…"
          aria-label="What you're in the mood for"
          onChange={(event) => setFocus(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Searching" : "Search"}
        </Button>
      </form>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="space-y-2" aria-label="Searching the web">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}
      {results && (
        <ul className="space-y-2" aria-live="polite">
          {results.map((found) => (
            <li key={found.url} className="flex flex-col gap-2 rounded-lg bg-background/60 p-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <a
                  href={found.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  {found.title}
                  <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </a>
                <p className="text-xs text-muted-foreground">{found.site}</p>
                {found.why && <p className="text-sm leading-5 text-muted-foreground">{found.why}</p>}
                {found.uses.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Uses your {found.uses.join(", ")}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(`/recipes/new?import=${encodeURIComponent(found.url)}`)}
              >
                Import
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Suggestions({ today, hasPantry }: { today: string; hasPantry: boolean }) {
  const { ai } = useSession();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<PantrySuggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    pantrySuggestions(today).then((result) => {
      if (!active) return;
      if (result.ok) setSuggestions(result.value);
      else toast.error(result.error);
    });
    return () => {
      active = false;
    };
  }, [today]);

  const addMissing = async (suggestion: PantrySuggestion) => {
    setBusy(suggestion.id);
    const result = await addMissingToShopping(suggestion.id, storedMeasure());
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Added ${result.value.added} ${result.value.added === 1 ? "item" : "items"} to your shopping list`,
      { action: { label: "View", onClick: () => navigate("/shopping") } }
    );
  };

  return (
    <div className="space-y-5">
      {suggestions && suggestions.length === 0 && (
        <div className="space-y-2 rounded-xl bg-card px-4 py-8 text-center ring-1 ring-foreground/10">
          <h2 className="text-base font-medium">
            {hasPantry ? "Nothing in your recipes matches yet" : "Add what you have first"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasPantry
              ? "Add more to your pantry, or find something new below."
              : "Suggestions come from the recipes in your library that use what's in your pantry."}
          </p>
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((suggestion, index) => {
            const needed = suggestion.have.length + suggestion.missing.length;
            const minutes = formatMinutes(totalMinutes(suggestion.prepMinutes, suggestion.cookMinutes));
            return (
              <motion.li
                key={suggestion.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: easeOut, delay: Math.min(index, 6) * 0.03 }}
                className="flex gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
              >
                {suggestion.image ? (
                  <img src={suggestion.image} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="size-16 shrink-0 rounded-lg bg-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <Link to={`/recipes/${suggestion.id}`} className="truncate font-medium hover:underline">
                      {suggestion.title}
                    </Link>
                    {minutes && <span className="text-xs text-muted-foreground">{minutes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${suggestion.coverage * 100}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      You have {suggestion.have.length} of {needed}
                    </span>
                  </div>
                  {suggestion.expiring.length > 0 && (
                    <p className="text-xs font-medium text-foreground">
                      Uses up your {suggestion.expiring.join(", ")}
                    </p>
                  )}
                  {suggestion.missing.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        Need {suggestion.missing.join(", ")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy === suggestion.id}
                        onClick={() => void addMissing(suggestion)}
                      >
                        <ShoppingBasketIcon data-icon="inline-start" />
                        Add {suggestion.missing.length} to list
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-brand">You have everything</p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
      {ai && <ClaudeFinder hasPantry={hasPantry} />}
    </div>
  );
}

function PantryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "make" ? "make" : "have";
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [today] = useState(localDay);
  useTitle("Pantry · Mise");

  useEffect(() => {
    let active = true;
    listPantry().then((result) => {
      if (!active) return;
      if (result.ok) setItems(result.value);
      else toast.error(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const setTab = (next: "have" | "make") => {
    const search = new URLSearchParams(params);
    if (next === "make") search.set("tab", "make");
    else search.delete("tab");
    setParams(search, { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">Pantry</h1>
          <p className="text-sm text-muted-foreground">
            {items === null
              ? "Loading"
              : `${items.length} ${items.length === 1 ? "thing" : "things"} on hand`}
          </p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Pantry">
          {(
            [
              ["have", "In my pantry"],
              ["make", "What can I make"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                tab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {items !== null &&
        (tab === "have" ? (
          <PantryList items={items} today={today} onItems={setItems} />
        ) : (
          <Suggestions today={today} hasPantry={items.length > 0} />
        ))}
    </div>
  );
}

export { PantryPage };
