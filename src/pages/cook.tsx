import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListChecksIcon,
  ListOrderedIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { cn } from "cn";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { CookTimeline } from "@/components/cook-timeline";
import { StepText } from "@/components/step-text";
import { Button } from "@/components/ui/button";
import { cachedRecipe, getRecipe } from "@/lib/api";
import {
  anchorFor,
  clock,
  nextFiveMinutes,
  readPlan,
  savePlan,
  type CookPlan,
} from "@/lib/cook-plan";
import { buildTimeline } from "@/shared/timeline";
import { ingredientLine } from "@/lib/format";
import { easeOut } from "@/lib/motion";
import { scaleIngredient } from "@/lib/units";
import { useTitle } from "@/lib/use-title";
import { isMeasure, parenthetical, storedMeasure } from "@/lib/view";
import { NotFoundPage } from "@/pages/not-found";
import type { Recipe } from "@/shared/recipe";

const readSet = (key: string) => {
  try {
    const raw = sessionStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(value)
        ? value.filter((item): item is number => typeof item === "number")
        : []
    );
  } catch {
    return new Set<number>();
  }
};

const writeSet = (key: string, value: Set<number>) => {
  try {
    sessionStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // progress just won't survive a reload.
  }
};

/** keeps the screen on while cooking, where the browser allows it. */
const useWakeLock = () => {
  const [state, setState] = useState<"on" | "off" | "unsupported">(() =>
    "wakeLock" in navigator ? "off" : "unsupported"
  );
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        setState("on");
        lock.addEventListener("release", () => {
          if (!cancelled) setState("off");
        });
      } catch {
        setState("off");
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) void lock.release();
    };
  }, []);
  return state;
};

function CookScreen({ recipe }: { recipe: Recipe }) {
  const [params] = useSearchParams();
  const units = params.get("units");
  const system = isMeasure(units) ? units : storedMeasure();
  const requested = Number(params.get("servings"));
  const servings =
    recipe.servings &&
    Number.isFinite(requested) &&
    requested >= 0.5 &&
    requested <= 999
      ? requested
      : recipe.servings;
  const factor = recipe.servings && servings ? servings / recipe.servings : 1;
  const ingredients = recipe.ingredients.map((item) =>
    scaleIngredient(item, factor, system)
  );

  const doneKey = `mise-cook-${recipe.id}-ingredients`;
  const stepKey = `mise-cook-${recipe.id}-step`;
  const [checked, setChecked] = useState(() => readSet(doneKey));
  const [step, setStep] = useState(() => {
    try {
      const saved = Number(sessionStorage.getItem(stepKey));
      return Number.isInteger(saved) &&
        saved >= 0 &&
        saved < recipe.instructions.length
        ? saved
        : 0;
    } catch {
      return 0;
    }
  });
  const [view, setView] = useState<"steps" | "ingredients" | "timing">(
    recipe.instructions.length ? "steps" : "ingredients"
  );
  const [plan, setPlan] = useState<CookPlan | null>(() => readPlan(recipe.id));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const choosePlan = (next: CookPlan) => {
    setPlan(next);
    savePlan(recipe.id, next);
  };

  const openTiming = () => {
    if (!plan)
      choosePlan({
        mode: "start",
        time: nextFiveMinutes(new Date(now)),
        gap: 5,
      });
    setView("timing");
  };

  const plannedAt = plan
    ? buildTimeline(
        recipe.instructions,
        anchorFor(plan, now),
        plan.mode,
        plan.gap
      ).steps
    : null;
  const [direction, setDirection] = useState(1);
  const wake = useWakeLock();
  const touch = useRef<number | null>(null);
  const total = recipe.instructions.length;

  useTitle(`Cooking ${recipe.title} · Mise`);

  const go = (next: number) => {
    if (next < 0 || next >= total) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
    try {
      sessionStorage.setItem(stepKey, String(next));
    } catch {
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (view !== "steps") return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(step + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(step - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (index: number) => {
    const next = new Set(checked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setChecked(next);
    writeSet(doneKey, next);
  };

  const current = recipe.instructions[step];

  const pager = (
    <footer className="space-y-3 border-t px-4 py-3 sm:px-6">
      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {recipe.instructions.map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === step ? "w-6 bg-brand" : "w-1.5 bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-28"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          variant={view === "ingredients" ? "default" : "ghost"}
          size="lg"
          onClick={() =>
            setView(view === "ingredients" ? "steps" : "ingredients")
          }
        >
          {view === "ingredients" ? (
            <>
              <ListOrderedIcon data-icon="inline-start" />
              Steps
            </>
          ) : (
            <>
              <ListChecksIcon data-icon="inline-start" />
              <span className="max-sm:sr-only">Ingredients</span>
            </>
          )}
        </Button>
        {step < total - 1 ? (
          <Button
            type="button"
            size="lg"
            className="min-w-28"
            onClick={() => go(step + 1)}
          >
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        ) : (
          <Button asChild size="lg" className="min-w-28">
            <Link to={`/recipes/${recipe.id}`}>
              Done
              <CheckIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>
    </footer>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-6">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Leave cook mode"
        >
          <Link to={`/recipes/${recipe.id}`}>
            <XIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{recipe.title}</p>
          <p className="text-xs text-muted-foreground">
            {servings ? `${servings} servings · ` : ""}
            {wake === "on"
              ? "Screen stays on"
              : wake === "unsupported"
                ? "This browser may let the screen sleep"
                : "Screen may sleep"}
          </p>
        </div>
        {wake === "on" && (
          <SunIcon className="size-4 text-brand" aria-hidden="true" />
        )}
        <div
          className="flex basis-full rounded-lg bg-muted p-0.5 sm:basis-auto"
          role="tablist"
        >
          {(
            [
              ["steps", "Steps"],
              ["ingredients", "Ingredients"],
              ["timing", "Timing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              disabled={id !== "ingredients" && total === 0}
              onClick={() => (id === "timing" ? openTiming() : setView(id))}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50 sm:flex-none sm:px-3 sm:text-sm",
                view === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {label}
              {id === "ingredients" && ingredients.length > 0 && (
                <span className="ml-1 hidden text-xs text-muted-foreground tabular-nums sm:inline">
                  {checked.size}/{ingredients.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {view === "timing" && plan ? (
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <CookTimeline
            steps={recipe.instructions}
            current={step}
            plan={plan}
            now={now}
            onPlan={choosePlan}
            onJump={(index) => {
              go(index);
              setView("steps");
            }}
          />
        </div>
      ) : view === "ingredients" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <ul className="mx-auto max-w-2xl space-y-2">
              {ingredients.map((item, index) => {
                const done = checked.has(index);
                return (
                  <li key={`${item.name}-${index}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      onClick={() => toggle(index)}
                      className="flex w-full items-start gap-4 rounded-xl px-3 py-3 text-left text-xl leading-8 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg border-2",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        )}
                        aria-hidden="true"
                      >
                        {done && <CheckIcon className="size-4" />}
                      </span>
                      <span
                        className={cn(
                          "min-w-0",
                          done && "text-muted-foreground line-through"
                        )}
                      >
                        {ingredientLine(item)}
                        {item.note.trim() && (
                          <span className="text-muted-foreground">
                            {" "}
                            {parenthetical(item.note)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {ingredients.length === 0 && (
              <p className="text-center text-muted-foreground">
                No ingredients listed.
              </p>
            )}
          </div>
          {total > 0 && pager}
        </>
      ) : (
        <>
          <div
            className="flex flex-1 items-center overflow-y-auto px-5 py-8 sm:px-10"
            onTouchStart={(event) => {
              touch.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = touch.current;
              const end = event.changedTouches[0]?.clientX;
              touch.current = null;
              if (start === null || end === undefined) return;
              if (end - start < -60) go(step + 1);
              else if (end - start > 60) go(step - 1);
            }}
          >
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              {current && (
                <motion.div
                  key={step}
                  className="mx-auto w-full max-w-3xl space-y-4"
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -24 }}
                  transition={{ duration: 0.2, ease: easeOut }}
                >
                  <p className="text-sm font-medium text-muted-foreground tabular-nums">
                    Step {step + 1} of {total}
                    {plannedAt?.[step] && (
                      <span className="text-brand">
                        {" "}
                        · {clock(plannedAt[step].start)}
                      </span>
                    )}
                  </p>
                  <p className="text-2xl leading-relaxed text-balance sm:text-3xl sm:leading-relaxed">
                    <StepText
                      text={current.text}
                      step={step + 1}
                      recipe={recipe.title}
                      measure={system}
                      large
                    />
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

function CookPage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(() =>
    id ? cachedRecipe(id) : null
  );
  const [missing, setMissing] = useState(!id);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getRecipe(id).then((result) => {
      if (!active) return;
      if (result.ok) setRecipe(result.value);
      else if (!cachedRecipe(id)) setMissing(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (missing) return <NotFoundPage />;
  if (!recipe) return <RecipePlaceholder />;
  return <CookScreen key={recipe.id} recipe={recipe} />;
}

export { CookPage };
