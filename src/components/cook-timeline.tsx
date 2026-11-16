import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { anchorFor, clock, type CookPlan } from "@/lib/cook-plan";
import { buildTimeline } from "@/shared/timeline";

function CookTimeline({
  steps,
  current,
  plan,
  now,
  onPlan,
  onJump,
}: {
  steps: { text: string }[];
  current: number;
  plan: CookPlan;
  now: number;
  onPlan: (plan: CookPlan) => void;
  onJump: (index: number) => void;
}) {
  const timeline = buildTimeline(steps, anchorFor(plan, now), plan.mode, plan.gap);
  const late = timeline.start < now - 60_000;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Plan from">
            {(
              [
                ["start", "Start at"],
                ["ready", "Ready by"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={plan.mode === value}
                onClick={() => onPlan({ ...plan, mode: value })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  plan.mode === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            type="time"
            value={plan.time}
            aria-label={plan.mode === "start" ? "Start time" : "Ready time"}
            className="h-9 w-32"
            onChange={(event) => event.target.value && onPlan({ ...plan, time: event.target.value })}
          />
        </div>
        <p className="text-sm">
          Start <b className="tabular-nums">{clock(timeline.start)}</b> · ready{" "}
          <b className="tabular-nums">{clock(timeline.end)}</b>
          <span className="text-muted-foreground"> · {timeline.minutes} min</span>
        </p>
        {late && plan.mode === "ready" && (
          <p className="text-sm text-destructive">That start time has passed. Pick a later ready time.</p>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Steps without a time take</span>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Shorter"
            disabled={plan.gap <= 1}
            onClick={() => onPlan({ ...plan, gap: Math.max(1, plan.gap - 1) })}
          >
            <MinusIcon />
          </Button>
          <span className="w-12 text-center text-foreground tabular-nums">{plan.gap} min</span>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Longer"
            disabled={plan.gap >= 60}
            onClick={() => onPlan({ ...plan, gap: Math.min(60, plan.gap + 1) })}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      <ol className="space-y-1">
        {timeline.steps.map((entry) => (
          <li key={entry.index}>
            <button
              type="button"
              onClick={() => onJump(entry.index)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                entry.index === current && "bg-brand/10 ring-1 ring-brand/40"
              )}
            >
              <span className="w-16 shrink-0 text-sm font-medium tabular-nums">{clock(entry.start)}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm leading-5">
                  <span className="text-muted-foreground">{entry.index + 1}. </span>
                  {steps[entry.index]?.text}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  entry.timed ? "text-foreground" : "text-muted-foreground"
                )}
                title={entry.timed ? undefined : "No time in this step"}
              >
                {entry.timed ? "" : "~"}
                {entry.minutes} min
              </span>
            </button>
          </li>
        ))}
        <li className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-16 shrink-0 font-medium tabular-nums">{clock(timeline.end)}</span>
          <span className="font-medium text-brand">Ready</span>
        </li>
      </ol>
    </div>
  );
}

export { CookTimeline };
