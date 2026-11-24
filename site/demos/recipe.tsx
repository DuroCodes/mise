import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { RecipeView } from "@/components/recipe-view";
import { StepText } from "@/components/step-text";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/lib/motion";
import type { Measure } from "@/lib/units";
import { shakshuka } from "../demo-data";

/** the app's recipe page (src/components/recipe-view.tsx), as it ships. */
function RecipeDemo() {
  const [servings, setServings] = useState(shakshuka.servings ?? 4);
  const [system, setSystem] = useState<Measure>("original");

  return (
    <RecipeView
      recipe={shakshuka}
      servings={servings}
      onServings={setServings}
      system={system}
      onSystem={setSystem}
    />
  );
}

/**
 * cook mode, cut down to fit a card. the real one (src/pages/cook.tsx) takes
 * over the whole screen; the step text and its timers are the same component.
 */
function CookDemo() {
  const steps = shakshuka.instructions;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const current = steps[step];
  const last = step === steps.length - 1;

  const go = (next: number) => {
    const target = Math.min(steps.length - 1, Math.max(0, next));
    if (target === step) return;
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  return (
    <div
      role="group"
      aria-label="Cook mode"
      tabIndex={0}
      className="flex min-h-76 flex-col rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(step + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(step - 1);
        }
      }}
    >
      <header className="flex items-center gap-2 border-b px-4 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{shakshuka.title}</p>
          <p className="text-xs text-muted-foreground">
            {shakshuka.servings} servings · Screen stays on
          </p>
        </div>
        <SunIcon className="size-4 text-brand" aria-hidden="true" />
      </header>

      <div className="flex flex-1 items-center overflow-hidden px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {current && (
            <motion.div
              key={step}
              className="w-full space-y-3"
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: easeOut }}
            >
              <p className="text-sm font-medium text-muted-foreground tabular-nums">
                Step {step + 1} of {steps.length}
              </p>
              <p className="text-xl text-balance sm:text-2xl">
                <StepText
                  text={current.text}
                  step={step + 1}
                  recipe={shakshuka.title}
                  large
                />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-24"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Back
        </Button>
        {last ? (
          <Button
            type="button"
            size="lg"
            className="min-w-24"
            onClick={() => go(0)}
          >
            Done
            <CheckIcon data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="min-w-24"
            onClick={() => go(step + 1)}
          >
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        )}
      </footer>
    </div>
  );
}

export { CookDemo, RecipeDemo };
