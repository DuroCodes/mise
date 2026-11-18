import { ChefHatIcon, TrashIcon } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addCookLog,
  listCookLogs,
  removeCookLog,
  type CookLog as Entry,
} from "@/lib/api";
import { dayFromKey, localDay } from "@/lib/view";

const longDay = (key: string) =>
  dayFromKey(key).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function CookLog({
  recipeId,
  selfId,
  isAdmin,
  onChange,
}: {
  recipeId: string;
  selfId: string;
  isAdmin: boolean;
  onChange: (entries: Entry[]) => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(localDay);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listCookLogs(recipeId).then((result) => {
      if (active && result.ok) setEntries(result.value);
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Pick a date");
      return;
    }
    setPending(true);
    setError(null);
    const result = await addCookLog(recipeId, { cookedOn: day, note });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEntries(result.value);
    onChange(result.value);
    setNote("");
    setDay(localDay());
    setOpen(false);
    toast.success("Added to the cooking log");
  };

  const remove = async (id: string) => {
    const result = await removeCookLog(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const next = (entries ?? []).filter((entry) => entry.id !== id);
    setEntries(next);
    onChange(next);
  };

  return (
    <section className="min-w-0 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Cooking log</h2>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (pending) return;
            setOpen(next);
            if (!next) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <ChefHatIcon data-icon="inline-start" />I made this
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log a cook</DialogTitle>
              <DialogDescription>
                What would you change next time?
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="cooked-on">Date</Label>
                <Input
                  id="cooked-on"
                  type="date"
                  value={day}
                  max={localDay()}
                  onChange={(event) => setDay(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cook-note">Notes</Label>
                <Textarea
                  id="cook-note"
                  value={note}
                  maxLength={1000}
                  placeholder="Needed more salt. Doubled the garlic."
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {entries === null ? null : entries.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHatIcon className="size-4" aria-hidden="true" />
          Nobody has logged this one yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex gap-3 rounded-xl bg-card px-3 text-sm ring-1 ring-foreground/10",
                entry.note ? "items-start py-3" : "items-center py-2"
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {entry.userName}
                  </span>{" "}
                  · {longDay(entry.cookedOn)}
                </p>
                {entry.note && (
                  <p className="leading-6 whitespace-pre-line">{entry.note}</p>
                )}
              </div>
              {(entry.userId === selfId || isAdmin) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove the entry from ${longDay(entry.cookedOn)}`}
                  onClick={() => remove(entry.id)}
                >
                  <TrashIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { CookLog };
