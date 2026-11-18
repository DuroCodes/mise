import { PrinterIcon, UtensilsCrossedIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { RecipeView } from "@/components/recipe-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getSharedRecipe } from "@/lib/api";
import type { Measure } from "@/lib/units";
import { useTitle } from "@/lib/use-title";
import { saveMeasure, storedMeasure } from "@/lib/view";
import type { SharedRecipe } from "@/shared/recipe";

function SharedView({ recipe }: { recipe: SharedRecipe }) {
  const [servings, setServings] = useState(recipe.servings ?? 1);
  const [system, setSystem] = useState<Measure>(storedMeasure);
  return (
    <RecipeView
      recipe={recipe}
      servings={servings}
      onServings={setServings}
      system={system}
      onSystem={(measure) => {
        setSystem(measure);
        saveMeasure(measure);
      }}
      byline={recipe.ownerName ? `shared by ${recipe.ownerName}` : null}
      toolbar={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.print()}
        >
          <PrinterIcon data-icon="inline-start" />
          Print
        </Button>
      }
    />
  );
}

function SharedPage() {
  const { token } = useParams();
  const [recipe, setRecipe] = useState<SharedRecipe | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "This link no longer works"
  );
  useTitle(recipe ? `${recipe.title} · Mise` : "Mise");

  useEffect(() => {
    if (!token) return;
    let active = true;
    getSharedRecipe(token).then((result) => {
      if (!active) return;
      if (result.ok) setRecipe(result.value);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="min-h-svh">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-lg font-medium tracking-tight">
            <UtensilsCrossedIcon
              className="size-5 text-brand"
              aria-hidden="true"
            />
            Mise
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {error ? (
          <div className="space-y-3 py-10 text-center">
            <h1 className="text-2xl font-medium tracking-tight">{error}</h1>
            <p className="text-sm text-muted-foreground">
              The person who shared it may have turned the link off.
            </p>
            <Button asChild variant="outline">
              <Link to="/">Go to Mise</Link>
            </Button>
          </div>
        ) : recipe ? (
          <SharedView recipe={recipe} />
        ) : (
          <RecipePlaceholder />
        )}
      </main>
    </div>
  );
}

export { SharedPage };
