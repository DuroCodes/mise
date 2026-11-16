import { FolderIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { RecipeCard } from "@/components/recipe-card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  removeFromCollection,
  updateCollection,
  type Collection,
  type CollectionSummary,
} from "@/lib/api";
import { useTitle } from "@/lib/use-title";
import { NotFoundPage } from "@/pages/not-found";

function CollectionForm({
  open,
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: { name: string; description: string };
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: { name: string; description: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name the collection");
      return;
    }
    setPending(true);
    const failure = await onSubmit({ name: name.trim(), description: description.trim() });
    setPending(false);
    if (failure) setError(failure);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              maxLength={80}
              placeholder="Weeknight dinners"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description</Label>
            <Textarea
              id="collection-description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CollectionsPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  useTitle("Collections · Mise");

  useEffect(() => {
    let active = true;
    listCollections().then((result) => {
      if (!active) return;
      if (result.ok) setCollections(result.value);
      else toast.error(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Group recipes for an occasion or a mood. Only you see your collections.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          New collection
        </Button>
      </div>

      {collections && collections.length === 0 && (
        <div className="space-y-3 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <h2 className="text-base font-medium">No collections yet</h2>
          <p className="text-sm text-muted-foreground">
            Make one here, or use “Collect” on any recipe.
          </p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(collections ?? []).map((collection) => (
          <li key={collection.id}>
            <Link
              to={`/collections/${collection.id}`}
              className="block overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <div className="grid aspect-[2/1] grid-cols-2 grid-rows-2 gap-0.5 bg-muted">
                {collection.images.length === 0 ? (
                  <div className="col-span-2 row-span-2 flex items-center justify-center">
                    <FolderIcon className="size-8 text-muted-foreground/50" aria-hidden="true" />
                  </div>
                ) : (
                  collection.images.map((image, index) => (
                    <img
                      key={`${image}-${index}`}
                      src={image}
                      alt=""
                      className={
                        collection.images.length === 1
                          ? "col-span-2 row-span-2 size-full object-cover"
                          : collection.images.length === 2
                            ? "row-span-2 size-full object-cover"
                            : collection.images.length === 3 && index === 0
                              ? "row-span-2 size-full object-cover"
                              : "size-full object-cover"
                      }
                    />
                  ))
                )}
              </div>
              <div className="space-y-1 p-4">
                <h2 className="truncate text-base font-medium tracking-tight">{collection.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {collection.count} {collection.count === 1 ? "recipe" : "recipes"}
                  {collection.description && ` · ${collection.description}`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {creating && (
        <CollectionForm
          open
          title="New collection"
          initial={{ name: "", description: "" }}
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (value) => {
            const result = await createCollection(value);
            if (!result.ok) return result.error;
            navigate(`/collections/${result.value.id}`);
            return null;
          }}
        />
      )}
    </div>
  );
}

function CollectionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [missing, setMissing] = useState(!id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useTitle(collection ? `${collection.name} · Mise` : "Collection · Mise");

  useEffect(() => {
    if (!id) return;
    let active = true;
    getCollection(id).then((result) => {
      if (!active) return;
      if (result.ok) setCollection(result.value);
      else setMissing(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (missing) return <NotFoundPage />;
  if (!collection) return null;

  const remove = async (recipeId: string) => {
    const result = await removeFromCollection(collection.id, recipeId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCollection({
      ...collection,
      recipes: collection.recipes.filter((recipe) => recipe.id !== recipeId),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link to="/collections" className="hover:underline">
              Collections
            </Link>
          </p>
          <h1 className="text-2xl font-medium tracking-tight">{collection.name}</h1>
          {collection.description && (
            <p className="text-sm leading-6 text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon" aria-label="Rename collection" onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Delete collection" onClick={() => setDeleting(true)}>
            <TrashIcon />
          </Button>
        </div>
      </div>

      {collection.recipes.length === 0 ? (
        <div className="space-y-3 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <h2 className="text-base font-medium">This collection is empty</h2>
          <p className="text-sm text-muted-foreground">
            Open a recipe and use “Collect” to add it here.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Browse recipes</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collection.recipes.map((recipe) => (
            <li key={recipe.id} className="relative">
              <RecipeCard
                recipe={recipe}
                onFavorite={(recipeId, favorite) =>
                  setCollection({
                    ...collection,
                    recipes: collection.recipes.map((item) =>
                      item.id === recipeId ? { ...item, favorite } : item
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 left-2 bg-background/90"
                aria-label={`Remove ${recipe.title} from ${collection.name}`}
                onClick={() => remove(recipe.id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CollectionForm
          open
          title="Edit collection"
          initial={{ name: collection.name, description: collection.description }}
          submitLabel="Save"
          onClose={() => setEditing(false)}
          onSubmit={async (value) => {
            const result = await updateCollection(collection.id, value);
            if (!result.ok) return result.error;
            setCollection({ ...collection, ...value });
            setEditing(false);
            return null;
          }}
        />
      )}

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {collection.name}?</DialogTitle>
            <DialogDescription>The recipes stay in your library.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                const result = await deleteCollection(collection.id);
                if (!result.ok) toast.error(result.error);
                else navigate("/collections");
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CollectionPage, CollectionsPage };
