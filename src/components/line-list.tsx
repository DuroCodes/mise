import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
  GripVerticalIcon,
  PlusIcon,
  StickyNoteIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { easeOut } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isListedUnit, unitGroups, unitValue } from "@/lib/units";

type IngredientDraft = {
  key: string;
  amount: string;
  unit: string;
  name: string;
  note: string;
};

type InstructionDraft = {
  key: string;
  text: string;
};

const useReorder = <T extends { key: string }>(
  items: T[],
  onChange: (items: T[]) => void
) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  };

  return { sensors, onDragEnd };
};

function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl bg-card p-3 ring-1 ring-foreground/10",
        isDragging && "z-10 shadow-md"
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: easeOut }}
      >
        {children(
          <button
            type="button"
            className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label={label}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        )}
      </motion.div>
    </li>
  );
}

function SortableRows<T extends { key: string }>({
  items,
  onChange,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  children: ReactNode;
}) {
  const { sensors, onDragEnd } = useReorder(items, onChange);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.key)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

function UnitSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (unit: string) => void;
}) {
  const selected = unitValue(value);

  return (
    <Select
      value={selected || "none"}
      onValueChange={(unit) => onChange(unit === "none" ? "" : unit)}
    >
      <SelectTrigger aria-label={label} className="w-full min-w-0 px-2">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">none</SelectItem>
        {selected && !isListedUnit(selected) && (
          <SelectItem value={selected}>{selected}</SelectItem>
        )}
        {unitGroups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.units.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function IngredientList({
  items,
  errors,
  onChange,
}: {
  items: IngredientDraft[];
  errors: Record<string, string>;
  onChange: (items: IngredientDraft[]) => void;
}) {
  const [notes, setNotes] = useState<Record<string, boolean>>({});
  const update = (index: number, patch: Partial<IngredientDraft>) =>
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  const showNote = (item: IngredientDraft) =>
    notes[item.key] ?? item.note.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <h2 className="text-sm leading-none font-medium">Ingredients</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-0 bottom-0"
          onClick={() =>
            onChange([
              ...items,
              {
                key: crypto.randomUUID(),
                amount: "",
                unit: "",
                name: "",
                note: "",
              },
            ])
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      <SortableRows items={items} onChange={onChange}>
        <ul className="space-y-3">
          {items.map((item, index) => (
            <SortableRow
              key={item.key}
              id={item.key}
              label={`Drag ingredient ${index + 1}`}
            >
              {(handle) => {
                const noted = showNote(item);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {handle}
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[5.5rem_7rem_minmax(0,1fr)]">
                        <Input
                          aria-label={`Amount ${index + 1}`}
                          value={item.amount}
                          placeholder="1"
                          onChange={(event) =>
                            update(index, { amount: event.target.value })
                          }
                        />
                        <UnitSelect
                          label={`Unit ${index + 1}`}
                          value={item.unit}
                          onChange={(unit) => update(index, { unit })}
                        />
                        <Input
                          aria-label={`Ingredient ${index + 1}`}
                          className="col-span-2 sm:col-span-1"
                          value={item.name}
                          placeholder="spaghetti"
                          aria-invalid={Boolean(
                            errors[`ingredients.${index}.name`]
                          )}
                          onChange={(event) =>
                            update(index, { name: event.target.value })
                          }
                        />
                      </div>
                      {!noted && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          aria-label={`Add note ${index + 1}`}
                          onClick={() =>
                            setNotes((current) => ({
                              ...current,
                              [item.key]: true,
                            }))
                          }
                        >
                          <StickyNoteIcon />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ingredient ${index + 1}`}
                        onClick={() =>
                          onChange(
                            items.filter((_, itemIndex) => itemIndex !== index)
                          )
                        }
                      >
                        <XIcon />
                      </Button>
                    </div>
                    {noted && (
                      <motion.div
                        className="flex items-center gap-1"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: easeOut }}
                      >
                        <Input
                          aria-label={`Note ${index + 1}`}
                          className="min-w-0 flex-1"
                          value={item.note}
                          autoFocus={notes[item.key] === true && !item.note}
                          onChange={(event) => {
                            setNotes((current) => ({
                              ...current,
                              [item.key]: true,
                            }));
                            update(index, { note: event.target.value });
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove note ${index + 1}`}
                          onClick={() => {
                            setNotes((current) => ({
                              ...current,
                              [item.key]: false,
                            }));
                            update(index, { note: "" });
                          }}
                        >
                          <XIcon />
                        </Button>
                      </motion.div>
                    )}
                    {errors[`ingredients.${index}.name`] && (
                      <p className="text-sm text-destructive">
                        {errors[`ingredients.${index}.name`]}
                      </p>
                    )}
                  </div>
                );
              }}
            </SortableRow>
          ))}
        </ul>
      </SortableRows>
    </div>
  );
}

function InstructionList({
  items,
  errors,
  onChange,
}: {
  items: InstructionDraft[];
  errors: Record<string, string>;
  onChange: (items: InstructionDraft[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <h2 className="text-sm leading-none font-medium">Instructions</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-0 bottom-0"
          onClick={() =>
            onChange([...items, { key: crypto.randomUUID(), text: "" }])
          }
        >
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      <SortableRows items={items} onChange={onChange}>
        <ol className="space-y-3">
          {items.map((item, index) => (
            <SortableRow
              key={item.key}
              id={item.key}
              label={`Drag step ${index + 1}`}
            >
              {(handle) => (
                <div className="flex items-center gap-1">
                  {handle}
                  <span className="w-6 shrink-0 text-center text-sm text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Textarea
                      aria-label={`Step ${index + 1}`}
                      rows={1}
                      value={item.text}
                      className="min-h-8 py-1.5"
                      aria-invalid={Boolean(
                        errors[`instructions.${index}.text`]
                      )}
                      onChange={(event) =>
                        onChange(
                          items.map((step, stepIndex) =>
                            stepIndex === index
                              ? { ...step, text: event.target.value }
                              : step
                          )
                        )
                      }
                    />
                    {errors[`instructions.${index}.text`] && (
                      <p className="text-sm text-destructive">
                        {errors[`instructions.${index}.text`]}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() =>
                      onChange(
                        items.filter((_, stepIndex) => stepIndex !== index)
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
              )}
            </SortableRow>
          ))}
        </ol>
      </SortableRows>
    </div>
  );
}

export { IngredientList, InstructionList };
export type { IngredientDraft, InstructionDraft };
