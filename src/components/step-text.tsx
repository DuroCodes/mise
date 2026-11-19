import { ThermometerIcon, TimerIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import { useTimers } from "@/lib/timer-context";
import type { Measure } from "@/lib/units";
import { convertTemperature, findTemperatures } from "@/shared/timeline";
import { findTimers } from "@/shared/timers";

type Piece =
  | {
      kind: "timer";
      start: number;
      end: number;
      label: string;
      seconds: number;
    }
  | {
      kind: "temp";
      start: number;
      end: number;
      value: number;
      scale: "F" | "C";
    };

const chipClass = (large: boolean) =>
  cn(
    "mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-brand/12 px-1.5 font-medium text-foreground print:bg-transparent print:p-0",
    large ? "py-0.5" : "py-0"
  );

/**
 * round dots via ::after — `decoration-dotted` paints squares and hugs glyphs.
 * one span for F + C so the line stays continuous without a flex gap.
 */
const chipTextClass = cn(
  "relative",
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-[1.4em] after:h-[3px]",
  "after:bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_50%,transparent)_1px,transparent_1.05px)]",
  "after:bg-size-[3.5px_3px] after:bg-repeat-x print:after:hidden"
);

/** split plain text so cook mode can flex-wrap with a real row gap. */
const textItems = (value: string, keyPrefix: string) => {
  const items: ReactNode[] = [];
  for (const [index, token] of value.split(/(\s+)/).entries()) {
    if (!token || /^\s+$/.test(token)) continue;
    items.push(
      <span key={`${keyPrefix}-${index}`} className="whitespace-pre">
        {token}
      </span>
    );
  }
  return items;
};

/**
 * a step's text, with each duration turned into a start-timer button and
 * oven temperatures called out (with a conversion when Metric/Imperial is on).
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
    ...findTemperatures(text).map((temp) => ({
      kind: "temp" as const,
      ...temp,
    })),
  ].sort((a, b) => a.start - b.start);

  if (!pieces.length) {
    if (!large) return <>{text}</>;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {textItems(text, "t")}
      </span>
    );
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  pieces.forEach((piece, index) => {
    if (piece.start < cursor) return;
    if (piece.start > cursor) {
      const slice = text.slice(cursor, piece.start);
      if (large) parts.push(...textItems(slice, `s-${piece.start}`));
      else parts.push(slice);
    }
    if (piece.kind === "temp") {
      const converted =
        want && piece.scale !== want
          ? convertTemperature(piece.value, piece.scale)
          : null;
      parts.push(
        <span key={`t-${piece.start}`} className={chipClass(large)}>
          <ThermometerIcon
            className={cn(
              "shrink-0 self-center text-brand print:hidden",
              large ? "size-5" : "size-3.5"
            )}
            aria-hidden="true"
          />
          <span className={chipTextClass}>
            {text.slice(piece.start, piece.end)}
            {converted && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({converted.value}°{converted.scale})
              </span>
            )}
          </span>
        </span>
      );
    } else {
      parts.push(
        <button
          key={`${piece.start}-${index}`}
          type="button"
          className={cn(
            chipClass(large),
            "outline-none hover:bg-brand/20 focus-visible:ring-3 focus-visible:ring-ring"
          )}
          aria-label={`Start a ${piece.label} timer`}
          onClick={() =>
            start(`Step ${step}: ${piece.label}`, piece.seconds, recipe)
          }
        >
          <TimerIcon
            className={cn(
              "shrink-0 self-center text-brand print:hidden",
              large ? "size-5" : "size-3.5"
            )}
            aria-hidden="true"
          />
          <span className={chipTextClass}>{piece.label}</span>
        </button>
      );
    }
    cursor = piece.end;
  });
  if (cursor < text.length) {
    const slice = text.slice(cursor);
    if (large) parts.push(...textItems(slice, "e"));
    else parts.push(slice);
  }

  if (large) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {parts}
      </span>
    );
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}

export { StepText };
