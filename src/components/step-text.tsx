import { TimerIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import { useTimers } from "@/lib/timer-context";
import type { Measure } from "@/lib/units";
import { convertTemperature, findTemperatures } from "@/shared/timeline";
import { findTimers } from "@/shared/timers";

type Piece =
  | { kind: "timer"; start: number; end: number; label: string; seconds: number }
  | { kind: "temp"; start: number; end: number; value: number; scale: "F" | "C" };

/**
 * A step's text, with each duration turned into a start-timer button and,
 * when a unit system is chosen, oven temperatures shown in it too.
 */
function StepText({
  text,
  step,
  recipe,
  measure = "original",
  large = false,
}: {
  text: string;
  step: number;
  recipe: string;
  measure?: Measure;
  large?: boolean;
}) {
  const { start } = useTimers();
  const want = measure === "metric" ? "C" : measure === "imperial" ? "F" : null;
  const pieces: Piece[] = [
    ...findTimers(text).map((timer) => ({ kind: "timer" as const, ...timer })),
    ...(want
      ? findTemperatures(text)
          .filter((temp) => temp.scale !== want)
          .map((temp) => ({ kind: "temp" as const, ...temp }))
      : []),
  ].sort((a, b) => a.start - b.start);

  if (pieces.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  pieces.forEach((piece, index) => {
    if (piece.start < cursor) return;
    if (piece.start > cursor) parts.push(text.slice(cursor, piece.start));
    if (piece.kind === "temp") {
      const converted = convertTemperature(piece.value, piece.scale);
      parts.push(
        <span key={`t-${piece.start}`}>
          {text.slice(piece.start, piece.end)}
          <span className="text-muted-foreground">
            {" "}
            ({converted.value}°{converted.scale})
          </span>
        </span>
      );
    } else {
      parts.push(
        <button
          key={`${piece.start}-${index}`}
          type="button"
          className={cn(
            "mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-brand/12 px-1.5 font-medium text-foreground underline decoration-brand/50 decoration-dotted underline-offset-4 outline-none hover:bg-brand/20 focus-visible:ring-3 focus-visible:ring-ring print:bg-transparent print:p-0 print:no-underline",
            large ? "py-0.5" : "py-0"
          )}
          aria-label={`Start a ${piece.label} timer`}
          onClick={() => start(`Step ${step}: ${piece.label}`, piece.seconds, recipe)}
        >
          <TimerIcon
            className={cn(
              "shrink-0 self-center text-brand print:hidden",
              large ? "size-5" : "size-3.5"
            )}
            aria-hidden="true"
          />
          {piece.label}
        </button>
      );
    }
    cursor = piece.end;
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
