import { CheckIcon, FolderIcon, FolderPlusIcon, PlusIcon } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addToCollection,
  createCollection,
  listCollections,
  recipeCollections,
  removeFromCollection,
  type CollectionSummary,
} from "@/lib/api";
import { LinesSkeleton } from "@/components/ui/skeleton";

function AddToCollection({ recipeId }: { recipeId: string }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(
    null
  );
  const [member, setMember] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [all, mine] = await Promise.all([
      listCollections(),
      recipeCollections(recipeId),
    ]);
    if (!all.ok) {
      toast.error(all.error);
      return;
    }
    setCollections(all.value);
    setMember(new Set(mine.ok ? mine.value : []));
  };

  const toggle = async (id: string) => {
    setBusy(id);
    const inside = member.has(id);
    const result = inside
      ? await removeFromCollection(id, recipeId)
      : await addToCollection(id, recipeId);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const next = new Set(member);
    if (inside) next.delete(id);
    else next.add(id);
    setMember(next);
  };

  const create = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy("new");
    const created = await createCollection({ name: trimmed, description: "" });
    if (!created.ok) {
      setBusy(null);
      toast.error(created.error);
      return;
    }
    await addToCollection(created.value.id, recipeId);
    setName("");
    setBusy(null);
    await load();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FolderPlusIcon data-icon="inline-start" />
          Collect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collections</DialogTitle>
          <DialogDescription>
            Your collections are private to you.
          </DialogDescription>
        </DialogHeader>
        {collections === null ? (
          <LinesSkeleton label="Loading collections" rows={3} line="h-9" />
        ) : collections.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderIcon className="size-4 shrink-0" aria-hidden="true" />
            No collections yet. Make the first one below.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {collections.map((collection) => {
              const inside = member.has(collection.id);
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={inside}
                    disabled={busy !== null}
                    onClick={() => toggle(collection.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        inside &&
                          "border-primary bg-primary text-primary-foreground"
                      )}
                      aria-hidden="true"
                    >
                      {inside && <CheckIcon className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {collection.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {collection.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={create} className="flex gap-2">
          <Input
            value={name}
            maxLength={80}
            placeholder="New collection"
            aria-label="New collection name"
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!name.trim() || busy !== null}
          >
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddToCollection };
