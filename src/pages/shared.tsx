import { ChefHatIcon, PrinterIcon, UtensilsCrossedIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import { CookScreen } from "@/pages/cook";

function SharedView({
  recipe,
  token,
}: {
  recipe: SharedRecipe;
  token: string;
}) {
  const [servings, setServings] = useState(recipe.servings ?? 1);
  const [system, setSystem] = useState<Measure>(storedMeasure);

  const cookParams = new URLSearchParams();
  if (recipe.servings && servings !== recipe.servings)
    cookParams.set("servings", String(servings));
  if (system !== "original") cookParams.set("units", system);
  const cookQuery = cookParams.toString();

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
      byline={recipe.ownerName ? `by ${recipe.ownerName}` : null}
      toolbar={
        <>
          <Button asChild size="sm">
            <Link
              to={`/s/${token}/cook${cookQuery ? `?${cookQuery}` : ""}`}
            >
              <ChefHatIcon data-icon="inline-start" />
              <span className="sm:hidden">Cook</span>
              <span className="max-sm:hidden">Cook mode</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="sm:hidden"
            aria-label="Print"
            onClick={() => window.print()}
          >
            <PrinterIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:hidden"
            onClick={() => window.print()}
          >
            <PrinterIcon data-icon="inline-start" />
            Print
          </Button>
        </>
      }
    />
  );
}

function SharedShell({ children }: { children: ReactNode }) {
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
        {children}
      </main>
    </div>
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
    <SharedShell>
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
      ) : recipe && token ? (
        <SharedView recipe={recipe} token={token} />
      ) : (
        <RecipePlaceholder />
      )}
    </SharedShell>
  );
}

function SharedCookPage() {
  const { token } = useParams();
  const [recipe, setRecipe] = useState<SharedRecipe | null>(null);
  const [error, setError] = useState<string | null>(
    token ? null : "This link no longer works"
  );

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

  if (error) {
    return (
      <SharedShell>
        <div className="space-y-3 py-10 text-center">
          <h1 className="text-2xl font-medium tracking-tight">{error}</h1>
          <Button asChild variant="outline">
            <Link to={token ? `/s/${token}` : "/"}>Back</Link>
          </Button>
        </div>
      </SharedShell>
    );
  }

  if (!recipe || !token) return <RecipePlaceholder />;

  return (
    <CookScreen
      key={token}
      recipe={recipe}
      storageKey={`share:${token}`}
      backTo={`/s/${token}`}
    />
  );
}

export { SharedPage, SharedCookPage };
