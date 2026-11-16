import { TimerIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import { useTimers } from "@/lib/timer-context";
import { findTimers } from "@/shared/timers";

/** A step's text, with each duration turned into a start-timer button. */
function StepText({
  text,
  step,
  recipe,
  large = false,
}: {
  text: string;
  step: number;
  recipe: string;
  large?: boolean;
}) {
  const { start } = useTimers();
  const found = findTimers(text);
  if (found.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  found.forEach((timer, index) => {
    if (timer.start > cursor) parts.push(text.slice(cursor, timer.start));
    parts.push(
      <button
        key={`${timer.start}-${index}`}
        type="button"
        className={cn(
          "mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-brand/12 px-1.5 font-medium text-foreground underline decoration-brand/50 decoration-dotted underline-offset-4 outline-none hover:bg-brand/20 focus-visible:ring-3 focus-visible:ring-ring print:bg-transparent print:p-0 print:no-underline",
          large ? "py-0.5" : "py-0"
        )}
        aria-label={`Start a ${timer.label} timer`}
        onClick={() => start(`Step ${step}: ${timer.label}`, timer.seconds, recipe)}
      >
        <TimerIcon
          className={cn(
            "shrink-0 self-center text-brand print:hidden",
            large ? "size-5" : "size-3.5"
          )}
          aria-hidden="true"
        />
        {timer.label}
      </button>
    );
    cursor = timer.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

export { StepText };
