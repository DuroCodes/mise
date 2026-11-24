import { CalendarDaysIcon } from "lucide-react";
import { cn } from "cn";
import { addDays, dayFromKey, localDay, weekStart } from "@/lib/view";
import { WEEK } from "../demo-data";

const short = (key: string) =>
  dayFromKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function PlanDemo() {
  const today = localDay();
  const monday = weekStart(today);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-lg font-medium tracking-tight">Meal plan</p>
        <p className="text-sm text-muted-foreground">
          {short(monday)} to {short(addDays(monday, 6))}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {days.map((day, index) => {
          const entries = WEEK.filter((entry) => entry.day === index);
          const date = dayFromKey(day);
          return (
            <section
              key={day}
              className={cn(
                "rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/10",
                day === today && "ring-2 ring-brand/60",
                // seven days in two columns: let Sunday close the grid.
                index === 6 && "sm:col-span-2"
              )}
            >
              <h3 className="mb-2 text-sm font-medium">
                {date.toLocaleDateString(undefined, { weekday: "long" })}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  {short(day)}
                  {day === today && " · today"}
                </span>
              </h3>
              {!entries.length ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDaysIcon className="size-3.5" aria-hidden="true" />
                  Nothing planned.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {entries.map((entry) => (
                    <li
                      key={`${entry.slot}-${entry.recipe.title}`}
                      className="flex min-w-0 items-center gap-2.5 rounded-lg bg-card p-1.5 ring-1 ring-foreground/10"
                    >
                      <span
                        className="size-9 shrink-0 rounded-md bg-muted"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.recipe.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.slot}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { PlanDemo };
