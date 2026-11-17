import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBasketIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "cn";
import { AiPlanner } from "@/components/ai-planner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addPlanEntry,
  addRecipesToShopping,
  listPlan,
  listRecipes,
  mealSlots,
  removePlanEntry,
  slotLabel,
  updatePlanEntry,
  type MealSlot,
  type PlanEntry,
} from "@/lib/api";
import { useSession } from "@/lib/session-context";
import { useTitle } from "@/lib/use-title";
import {
  addDays,
  dayFromKey,
  localDay,
  storedMeasure,
  weekStart,
} from "@/lib/view";
import type { Recipe } from "@/shared/recipe";

function DraggableRecipe({ recipe }: { recipe: Recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe:${recipe.id}`,
    data: { recipe },
  });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex cursor-grab touch-none items-center gap-2 rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
      {...attributes}
      {...listeners}
      aria-label={`Drag ${recipe.title} onto a day`}
    >
      <GripVerticalIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{recipe.title}</span>
    </li>
  );
}

function EntryCard({
  entry,
  onSlot,
  onRemove,
}: {
  entry: PlanEntry;
  onSlot: (slot: MealSlot) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry:${entry.id}`,
    data: { entry },
  });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg bg-card p-1.5 ring-1 ring-foreground/10",
        isDragging && "opacity-40"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Move ${entry.title} to another day`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {entry.image ? (
        <img
          src={entry.image}
          alt=""
          className="size-9 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className="size-9 shrink-0 rounded-md bg-muted"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <Link
          to={`/recipes/${entry.recipeId}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {entry.title}
        </Link>
        <Select
          value={entry.slot}
          onValueChange={(slot) => onSlot(slot as MealSlot)}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Meal for ${entry.title}`}
            className="mt-0.5"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mealSlots.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slotLabel[slot]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${entry.title} from this day`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}

function DayRow({
  day,
  entries,
  today,
  onAdd,
  onSlot,
  onRemove,
}: {
  day: string;
  entries: PlanEntry[];
  today: boolean;
  onAdd: () => void;
  onSlot: (entry: PlanEntry, slot: MealSlot) => void;
  onRemove: (entry: PlanEntry) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  const date = dayFromKey(day);
  return (
    <section
      ref={setNodeRef}
      aria-label={date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      className={cn(
        "rounded-xl p-3 ring-1 ring-foreground/10 transition-colors",
        isOver ? "bg-brand/10 ring-brand" : "bg-muted/30",
        today && !isOver && "ring-2 ring-brand/60"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          {date.toLocaleDateString(undefined, { weekday: "long" })}
          <span className="font-normal text-muted-foreground">
            {" "}
            {date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            {today && " · today"}
          </span>
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
          Nothing planned.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onSlot={(slot) => onSlot(entry, slot)}
              onRemove={() => onRemove(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = localDay();
  const requested = params.get("week");
  const start = weekStart(
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today
  );
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const end = days[6] ?? start;

  const [entries, setEntries] = useState<PlanEntry[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickSlot, setPickSlot] = useState<MealSlot>("dinner");
  const [dragging, setDragging] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [reload, setReload] = useState(0);
  const [planning, setPlanning] = useState(false);
  const { ai } = useSession();
  useTitle("Meal plan · Mise");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    let active = true;
    listPlan(start, end).then((result) => {
      if (!active) return;
      if (result.ok) setEntries(result.value);
      else toast.error(result.error);
    });
    return () => {
      active = false;
    };
  }, [start, end, reload]);

  useEffect(() => {
    let active = true;
    listRecipes().then((result) => {
      if (active && result.ok)
        setRecipes(
          [...result.value].sort((a, b) => a.title.localeCompare(b.title))
        );
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = () => setReload((value) => value + 1);

  const add = async (day: string, recipe: Recipe, slot: MealSlot) => {
    const result = await addPlanEntry({
      day,
      slot,
      recipeId: recipe.id,
      servings: recipe.servings,
    });
    if (!result.ok) toast.error(result.error);
    refresh();
  };

  const move = async (entry: PlanEntry, day: string) => {
    if (entry.day === day) return;
    setEntries(
      (current) =>
        current?.map((item) =>
          item.id === entry.id ? { ...item, day } : item
        ) ?? current
    );
    const result = await updatePlanEntry(entry.id, { day });
    if (!result.ok) toast.error(result.error);
    refresh();
  };

  const setSlot = async (entry: PlanEntry, slot: MealSlot) => {
    setEntries(
      (current) =>
        current?.map((item) =>
          item.id === entry.id ? { ...item, slot } : item
        ) ?? current
    );
    const result = await updatePlanEntry(entry.id, { slot });
    if (!result.ok) toast.error(result.error);
    refresh();
  };

  const remove = async (entry: PlanEntry) => {
    setEntries(
      (current) => current?.filter((item) => item.id !== entry.id) ?? current
    );
    const result = await removePlanEntry(entry.id);
    if (!result.ok) {
      toast.error(result.error);
      refresh();
    }
  };

  const onDragStart = (event: DragStartEvent) =>
    setDragging(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const over = event.over ? String(event.over.id) : "";
    if (!over.startsWith("day:")) return;
    const day = over.slice(4);
    const data = event.active.data.current as
      { recipe?: Recipe; entry?: PlanEntry } | undefined;
    if (data?.recipe) void add(day, data.recipe, "dinner");
    else if (data?.entry) void move(data.entry, day);
  };

  const toShopping = async () => {
    if (!entries || entries.length === 0) return;
    setAdding(true);
    const result = await addRecipesToShopping(
      entries.map((entry) => ({
        recipeId: entry.recipeId,
        servings: entry.servings ?? entry.recipeServings,
      })),
      storedMeasure()
    );
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Added this week to your shopping list", {
      action: { label: "View", onClick: () => navigate("/shopping") },
    });
  };

  const goWeek = (key: string) => {
    const next = new URLSearchParams(params);
    if (key === weekStart(today)) next.delete("week");
    else next.set("week", key);
    setParams(next, { replace: true });
  };

  const shown = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(query.trim().toLowerCase())
  );
  const dragged = dragging?.startsWith("recipe:")
    ? recipes.find((recipe) => `recipe:${recipe.id}` === dragging)?.title
    : dragging?.startsWith("entry:")
      ? entries?.find((entry) => `entry:${entry.id}` === dragging)?.title
      : null;

  const rangeLabel = `${dayFromKey(start).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${dayFromKey(end).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium tracking-tight">Meal plan</h1>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous week"
                onClick={() => goWeek(addDays(start, -7))}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={start === weekStart(today)}
                onClick={() => goWeek(weekStart(today))}
              >
                This week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next week"
                onClick={() => goWeek(addDays(start, 7))}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            {ai && (
              <Button
                type="button"
                variant="outline"
                disabled={!entries || recipes.length === 0}
                onClick={() => setPlanning(true)}
              >
                <SparklesIcon data-icon="inline-start" />
                <span className="sm:hidden">Plan</span>
                <span className="max-sm:hidden">Plan with AI</span>
              </Button>
            )}
            <Button
              type="button"
              disabled={adding || !entries || entries.length === 0}
              aria-busy={adding}
              onClick={toShopping}
            >
              <motion.span
                className="inline-flex"
                animate={adding ? { rotate: [0, -8, 6, 0] } : { rotate: 0 }}
                transition={
                  adding
                    ? { duration: 0.6, ease: "easeInOut", repeat: Infinity }
                    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                }
              >
                <ShoppingBasketIcon data-icon="inline-start" />
              </motion.span>
              <span className="sm:hidden">Shopping</span>
              <span className="max-sm:hidden">Shopping list</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="hidden space-y-3 lg:block">
            <div className="sticky top-20 space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Recipes</h2>
                <p className="text-xs text-muted-foreground">
                  Drag one onto a day.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    placeholder="Filter"
                    aria-label="Filter recipes"
                    className="pl-8"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <ul className="max-h-[calc(100svh-16rem)] space-y-1.5 overflow-y-auto">
                  {shown.map((recipe) => (
                    <DraggableRecipe key={recipe.id} recipe={recipe} />
                  ))}
                  {shown.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      No recipes match.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </aside>

          <div className="space-y-3">
            {days.map((day) => (
              <DayRow
                key={day}
                day={day}
                today={day === today}
                entries={(entries ?? []).filter((entry) => entry.day === day)}
                onAdd={() => {
                  setQuery("");
                  setPickedDay(day);
                  setPicking(day);
                }}
                onSlot={setSlot}
                onRemove={remove}
              />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <div className="rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-foreground/10">
            {dragged}
          </div>
        ) : null}
      </DragOverlay>

      {ai && (
        <AiPlanner
          open={planning}
          onOpenChange={setPlanning}
          days={days}
          today={today}
          entries={entries ?? []}
          onAdded={refresh}
        />
      )}

      <Dialog
        open={picking !== null}
        onOpenChange={(open) => !open && setPicking(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add to{" "}
              {pickedDay &&
                dayFromKey(pickedDay).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
            </DialogTitle>
            <DialogDescription>Pick a meal, then a recipe.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Select
              value={pickSlot}
              onValueChange={(slot) => setPickSlot(slot as MealSlot)}
            >
              <SelectTrigger aria-label="Meal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mealSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slotLabel[slot]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={query}
              placeholder="Search recipes"
              aria-label="Search recipes"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {shown.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                  onClick={() => {
                    if (picking) void add(picking, recipe, pickSlot);
                    setPicking(null);
                  }}
                >
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt=""
                      className="size-8 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="size-8 shrink-0 rounded-md bg-muted"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 truncate">{recipe.title}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted-foreground">
                No recipes match.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

export { PlanPage };
