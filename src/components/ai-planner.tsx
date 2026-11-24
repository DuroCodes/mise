import { ClockIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { InlineError } from "@/components/inline-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addPlanEntry,
  mealSlots,
  planWeekWithAi,
  slotLabel,
  type MealSlot,
  type PlanEntry,
  type PlannedMeal,
} from "@/lib/api";
import { dayFromKey } from "@/lib/view";

const chip =
  "rounded-4xl px-3 py-1.5 text-sm font-medium ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40";
const chipOn = "bg-brand text-brand-foreground ring-brand";
const chipOff =
  "bg-transparent text-foreground ring-foreground/15 hover:bg-muted";

const shortDay = (day: string) =>
  dayFromKey(day).toLocaleDateString(undefined, { weekday: "short" });
const longDay = (day: string) =>
  dayFromKey(day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

const openDays = (days: string[], today: string, entries: PlanEntry[]) =>
  days.filter(
    (day) =>
      day >= today &&
      !entries.some((entry) => entry.day === day && entry.slot === "dinner")
  );

function AiPlanner({
  open,
  onOpenChange,
  days,
  today,
  entries,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: string[];
  today: string;
  entries: PlanEntry[];
  onAdded: () => void;
}) {
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [pickedSlots, setPickedSlots] = useState<MealSlot[]>(["dinner"]);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{
    summary: string;
    meals: PlannedMeal[];
  } | null>(null);
  const [lastWeek, setLastWeek] = useState<string | null>(null);

  // reset the request whenever the dialog opens on a different week.
  const weekKey = days[0] ?? "";
  if (open && weekKey !== lastWeek) {
    setLastWeek(weekKey);
    setPickedDays(openDays(days, today, entries));
    setPlan(null);
    setError(null);
  }

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item)
      ? list.filter((value) => value !== item)
      : [...list, item];

  const taken = (day: string, slot: MealSlot) =>
    entries.some((entry) => entry.day === day && entry.slot === slot);

  const fill = days
    .filter((day) => pickedDays.includes(day))
    .map((day) => ({
      day,
      slots: mealSlots.filter(
        (slot) => pickedSlots.includes(slot) && !taken(day, slot)
      ),
    }))
    .filter((entry) => entry.slots.length > 0);

  const request = async (event?: SubmitEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (pending) return;
    if (!pickedDays.length || !pickedSlots.length) {
      setError("Pick at least one day and one meal");
      return;
    }
    if (!fill.length) {
      setError("Those meals are already planned");
      return;
    }
    setPending(true);
    setError(null);
    const result = await planWeekWithAi({ today, fill, notes });
    setPending(false);
    if (result.ok) setPlan(result.value);
    else setError(result.error);
  };

  const drop = (meal: PlannedMeal) =>
    setPlan((current) =>
      current
        ? { ...current, meals: current.meals.filter((item) => item !== meal) }
        : current
    );

  const save = async () => {
    if (!plan || saving) return;
    setSaving(true);
    let added = 0;
    for (const meal of plan.meals) {
      const result = await addPlanEntry({
        day: meal.day,
        slot: meal.slot,
        recipeId: meal.recipeId,
        servings: meal.servings,
      });
      if (result.ok) added += 1;
    }
    setSaving(false);
    onAdded();
    if (added < plan.meals.length)
      toast.error(`Added ${added} of ${plan.meals.length} meals`);
    else
      toast.success(
        `Added ${added} ${added === 1 ? "meal" : "meals"} to your plan`
      );
    setPlan(null);
    onOpenChange(false);
  };

  const grouped = days
    .map((day) => ({
      day,
      meals: (plan?.meals ?? [])
        .filter((meal) => meal.day === day)
        .sort((a, b) => mealSlots.indexOf(a.slot) - mealSlots.indexOf(b.slot)),
    }))
    .filter((group) => group.meals.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && !saving && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <SparklesIcon className="size-4 text-brand" aria-hidden="true" />
            Plan with AI
          </DialogTitle>
          <DialogDescription>
            {plan
              ? "Drop anything you don't want, then add the rest."
              : "Picks from your recipes, using your pantry and what you've cooked lately. Your recipe list and pantry are sent to the AI provider."}
          </DialogDescription>
        </DialogHeader>

        {!plan && (
          <form id="ai-plan" onSubmit={request} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Days</legend>
              <div className="flex flex-wrap gap-1.5">
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={pickedDays.includes(day)}
                    aria-label={longDay(day)}
                    disabled={pending}
                    className={cn(
                      chip,
                      pickedDays.includes(day) ? chipOn : chipOff
                    )}
                    onClick={() => setPickedDays((list) => toggle(list, day))}
                  >
                    {shortDay(day)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Meals</legend>
              <div className="flex flex-wrap gap-1.5">
                {mealSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={pickedSlots.includes(slot)}
                    disabled={pending}
                    className={cn(
                      chip,
                      pickedSlots.includes(slot) ? chipOn : chipOff
                    )}
                    onClick={() => setPickedSlots((list) => toggle(list, slot))}
                  >
                    {slotLabel[slot]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Meals you've already planned stay as they are.
              </p>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="ai-plan-notes">Anything to keep in mind?</Label>
              <Textarea
                id="ai-plan-notes"
                value={notes}
                maxLength={500}
                disabled={pending}
                placeholder="Quick weeknights, fish once, something special Saturday, use up the spinach…"
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </form>
        )}

        <InlineError message={error} />

        {pending && (
          <div className="space-y-2" aria-label="Planning">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        )}

        {plan && (
          <div className="space-y-4" aria-live="polite">
            {plan.summary && (
              <p className="text-sm leading-6 text-muted-foreground">
                {plan.summary}
              </p>
            )}
            {!grouped.length && (
              <p className="text-sm text-muted-foreground">
                Nothing left to add.
              </p>
            )}
            {grouped.map((group) => (
              <section key={group.day} className="space-y-1.5">
                <h3 className="text-sm font-medium">{longDay(group.day)}</h3>
                <ul className="space-y-1.5">
                  {group.meals.map((meal) => (
                    <li
                      key={`${meal.day}-${meal.slot}`}
                      className="flex items-start gap-3 rounded-lg bg-muted/40 p-2 ring-1 ring-foreground/10"
                    >
                      {meal.image ? (
                        <img
                          src={meal.image}
                          alt=""
                          className="size-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span
                          className="size-10 shrink-0 rounded-md bg-muted"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {meal.title}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {slotLabel[meal.slot]}
                          {meal.minutes !== null && meal.minutes > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <ClockIcon
                                className="size-3"
                                aria-hidden="true"
                              />
                              {meal.minutes} min
                            </>
                          )}
                        </p>
                        {meal.why && (
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                            {meal.why}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Drop ${meal.title}`}
                        disabled={saving}
                        onClick={() => drop(meal)}
                      >
                        <XIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <DialogFooter>
          {plan ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setPlan(null);
                  setError(null);
                }}
              >
                Change request
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setPlan(null);
                  void request();
                }}
              >
                Try again
              </Button>
              <Button
                type="button"
                disabled={saving || !plan.meals.length}
                aria-busy={saving}
                onClick={save}
              >
                {saving
                  ? "Adding"
                  : `Add ${plan.meals.length} ${plan.meals.length === 1 ? "meal" : "meals"}`}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              form="ai-plan"
              disabled={pending}
              aria-busy={pending}
            >
              <SparklesIcon data-icon="inline-start" />
              {pending ? "Planning" : "Plan it"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AiPlanner };
