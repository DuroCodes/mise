import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PlusIcon,
  StoreIcon,
  TrashIcon,
} from "lucide-react";
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
import { createStore, deleteStore, listStores, updateStore } from "@/lib/api";
import { useTitle } from "@/lib/use-title";
import { fullLayout, type Store, type StoreSection } from "@/shared/stores";
import { ListSkeleton } from "@/components/ui/skeleton";

function SectionRow({
  section,
  index,
  count,
  onLabel,
  onMove,
}: {
  section: StoreSection;
  index: number;
  count: number;
  onLabel: (label: string) => void;
  onMove: (to: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.aisle });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 bg-card px-2 py-1.5 sm:px-3",
        isDragging &&
          "relative z-10 rounded-lg shadow-md ring-1 ring-foreground/10"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Drag ${section.aisle} to reorder`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {section.aisle}
      </span>
      <Input
        value={section.label}
        maxLength={24}
        placeholder="Aisle"
        aria-label={`Aisle label for ${section.aisle}`}
        className="h-7 w-24 text-sm sm:w-32"
        onChange={(event) => onLabel(event.target.value)}
      />
      <div className="flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${section.aisle} up`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ChevronUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${section.aisle} down`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ChevronDownIcon />
        </Button>
      </div>
    </li>
  );
}

function StoreEditor({
  store,
  onSaved,
  onDeleted,
}: {
  store: Store;
  onSaved: (stores: Store[]) => void;
  onDeleted: (stores: Store[]) => void;
}) {
  const [name, setName] = useState(store.name);
  const [layout, setLayout] = useState<StoreSection[]>(() =>
    fullLayout(store.layout)
  );
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saved = JSON.stringify({
    name: store.name,
    layout: fullLayout(store.layout),
  });
  const dirty = JSON.stringify({ name: name.trim(), layout }) !== saved;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = layout.findIndex((section) => section.aisle === active.id);
    const to = layout.findIndex((section) => section.aisle === over.id);
    if (from >= 0 && to >= 0) setLayout(arrayMove(layout, from, to));
  };

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Name the store");
      return;
    }
    setSaving(true);
    const result = await updateStore(store.id, {
      name: name.trim(),
      layout: layout.map((section) => ({
        ...section,
        label: section.label.trim(),
      })),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSaved(result.value);
    toast.success(`Saved ${name.trim()}`);
  };

  const remove = async () => {
    const result = await deleteStore(store.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setConfirming(false);
    onDeleted(result.value);
  };

  return (
    <form
      onSubmit={save}
      className="space-y-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4"
    >
      <div className="flex items-center gap-2">
        <StoreIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <Input
          value={name}
          maxLength={60}
          aria-label="Store name"
          className="h-8 font-medium"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${store.name}`}
          onClick={() => setConfirming(true)}
        >
          <TrashIcon />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag into walking order. Aisle labels are optional.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={layout.map((section) => section.aisle)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="divide-y overflow-hidden rounded-lg ring-1 ring-foreground/10">
            {layout.map((section, index) => (
              <SectionRow
                key={section.aisle}
                section={section}
                index={index}
                count={layout.length}
                onLabel={(label) =>
                  setLayout(
                    layout.map((item) =>
                      item.aisle === section.aisle ? { ...item, label } : item
                    )
                  )
                }
                onMove={(to) => setLayout(arrayMove(layout, index, to))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="flex justify-end gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setName(store.name);
              setLayout(fullLayout(store.layout));
            }}
          >
            Discard changes
          </Button>
        )}
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Saving" : dirty ? "Save" : "Saved"}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {store.name}?</DialogTitle>
            <DialogDescription>
              Your shopping list isn't affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function StoresPage() {
  const [stores, setStores] = useState<Store[] | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);
  useTitle("Stores · Mise");

  useEffect(() => {
    let active = true;
    listStores().then((result) => {
      if (!active) return;
      if (result.ok) setStores(result.value);
      else toast.error(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const add = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const result = await createStore(name.trim());
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setStores(result.value.stores);
    setVersion((value) => value + 1);
    setName("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link to="/shopping" className="hover:underline">
            Shopping list
          </Link>
        </p>
        <h1 className="text-2xl font-medium tracking-tight">My stores</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Pick a store on your shopping list to sort it in walking order.
        </p>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <Input
          value={name}
          maxLength={60}
          placeholder="Add a store, like Albertsons on Main"
          aria-label="New store name"
          className="h-10 text-base"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          className="h-10"
          disabled={adding || !name.trim()}
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>

      {stores === null && <ListSkeleton label="Loading stores" rows={3} />}

      {stores && !stores.length && (
        <div className="space-y-2 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <StoreIcon
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-base font-medium">No stores yet</h2>
          <p className="text-sm text-muted-foreground">
            Add the one you shop at most.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {(stores ?? []).map((store) => (
          <StoreEditor
            key={`${store.id}-${version}`}
            store={store}
            onSaved={setStores}
            onDeleted={(next) => {
              setStores(next);
              setVersion((value) => value + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export { StoresPage };
