import { ShoppingBasketIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatMinutes, totalMinutes } from "@/lib/format";
import { addDays, dayFromKey, localDay } from "@/lib/view";
import { rankRecipes } from "@/shared/pantry";
import type { SharedRecipe } from "@/shared/recipe";
import { pantry, recipes } from "../demo-data";

/** the same wording the pantry page uses (src/pages/pantry.tsx). */
const expiryLabel = (days: number, day: string) => {
  if (days === 0) return { text: "use today", tone: "bad" as const };
  if (days === 1) return { text: "use by tomorrow", tone: "soon" as const };
  if (days <= 3)
    return { text: `use within ${days} days`, tone: "soon" as const };
  return {
    text: `use by ${dayFromKey(day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    tone: "ok" as const,
  };
};

const heading = "px-1 text-sm font-medium";

/**
 * the pantry and "what can I make". the ranking is the app's own
 * (src/shared/pantry.ts), run over the demo recipes and this pantry.
 */
function PantryDemo({
  onAdd,
}: {
  onAdd: (recipe: SharedRecipe, missing: string[]) => void;
}) {
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const today = localDay();
  const shelf = pantry.map((item) => ({
    ...item,
    expiresOn: item.days === null ? null : addDays(today, item.days),
  }));
  const suggestions = rankRecipes(recipes, shelf, today).slice(0, 3);

  return (
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="space-y-2">
        <h3 className={heading}>
          Pantry{" "}
          <span className="font-normal text-muted-foreground">
            · {shelf.length} items
          </span>
        </h3>
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {shelf.map((item) => {
            const expiry =
              item.days !== null && item.expiresOn
                ? expiryLabel(item.days, item.expiresOn)
                : null;
            const amount = [item.amount, item.unit].filter(Boolean).join(" ");
            return (
              <li key={item.name} className="px-3 py-1.5">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-6">
                  {amount && (
                    <span className="font-medium tabular-nums">{amount}</span>
                  )}
                  <span>{item.name}</span>
                  {expiry && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[0.7rem] leading-5 font-medium",
                        expiry.tone === "bad" &&
                          "bg-destructive/15 text-destructive",
                        expiry.tone === "soon" && "bg-brand/15 text-foreground",
                        expiry.tone === "ok" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {expiry.text}
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className={heading}>What can I make</h3>
        <ul className="space-y-2">
          {suggestions.map((suggestion) => {
            const { recipe } = suggestion;
            const needed = suggestion.have.length + suggestion.missing.length;
            const minutes = formatMinutes(
              totalMinutes(recipe.prepMinutes, recipe.cookMinutes)
            );
            return (
              <li
                key={recipe.title}
                className="flex overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
              >
                <div className="w-16 shrink-0 self-stretch bg-muted sm:w-20">
                  {recipe.image && (
                    <img
                      src={recipe.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1 p-2.5 sm:p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="truncate font-medium">{recipe.title}</p>
                    {minutes && (
                      <span className="text-xs text-muted-foreground">
                        {minutes}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${suggestion.coverage * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      You have {suggestion.have.length} of {needed}
                    </span>
                  </div>
                  {suggestion.expiring.length > 0 && (
                    <p className="text-xs font-medium text-foreground">
                      Uses up your {suggestion.expiring.join(", ")}
                    </p>
                  )}
                  {suggestion.missing.length === 0 ? (
                    <p className="text-xs font-medium text-brand">
                      You have everything
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        Need {suggestion.missing.join(", ")}
                      </p>
                      {added.has(recipe.title) ? (
                        <p className="text-xs font-medium" role="status">
                          Added to{" "}
                          <a
                            href="#shopping"
                            className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                          >
                            the list above
                          </a>
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onAdd(recipe, suggestion.missing);
                            setAdded(new Set(added).add(recipe.title));
                          }}
                        >
                          <ShoppingBasketIcon data-icon="inline-start" />
                          Add {suggestion.missing.length} to list
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export { PantryDemo };
