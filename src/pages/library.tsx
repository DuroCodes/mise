import { SearchIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRecipes } from "@/lib/api";
import { easeIn, easeOut } from "@/lib/motion";
import { useTitle } from "@/lib/use-title";
import type { Recipe } from "@/shared/recipe";

const matches = (
  recipe: Recipe,
  query: string,
  tag: string,
  favorites: boolean
) => {
  if (favorites && !recipe.favorite) return false;
  if (
    tag &&
    !recipe.tags.some((item) => item.toLowerCase() === tag.toLowerCase())
  )
    return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    recipe.title,
    recipe.description,
    ...recipe.tags,
    ...recipe.ingredients.map(
      (item) => `${item.amount} ${item.unit} ${item.name} ${item.note}`
    ),
    ...recipe.instructions.map((item) => item.text),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
};

function LibraryPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  useTitle("Mise");

  const query = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const favorites = params.get("favorite") === "1";

  useEffect(() => {
    let active = true;
    listRecipes().then((result) => {
      if (!active) return;
      if (result.ok) setRecipes(result.value);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const setFilter = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const tags = [
    ...new Set((recipes ?? []).flatMap((recipe) => recipe.tags)),
  ].sort((a, b) => a.localeCompare(b));
  const shown = (recipes ?? []).filter((recipe) =>
    matches(recipe, query, tag, favorites)
  );
  const filtering = Boolean(query.trim() || tag || favorites);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium tracking-tight">Recipes</h1>
            <p className="text-sm text-muted-foreground">
              {recipes === null
                ? "Loading recipes"
                : filtering
                  ? `${shown.length} of ${recipes.length}`
                  : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
            </p>
          </div>
        </div>
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setFilter({ q: event.target.value })}
            placeholder="Search titles, ingredients, steps"
            aria-label="Search recipes"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={favorites ? "default" : "outline"}
            aria-pressed={favorites}
            onClick={() => setFilter({ favorite: favorites ? null : "1" })}
          >
            favorites
          </Button>
          {tags.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={
                item.toLowerCase() === tag.toLowerCase() ? "default" : "outline"
              }
              aria-pressed={item.toLowerCase() === tag.toLowerCase()}
              onClick={() =>
                setFilter({
                  tag: item.toLowerCase() === tag.toLowerCase() ? null : item,
                })
              }
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      )}

      {recipes && shown.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: easeOut }}
          className="space-y-3 rounded-xl bg-card px-4 py-10 text-center ring-1 ring-foreground/10"
        >
          <h2 className="text-base font-medium">
            {filtering ? "Nothing matches" : "No recipes yet"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtering
              ? "Try another search, or clear the filters."
              : "Add the first one when you are ready to cook it again."}
          </p>
          {filtering ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setParams({}, { replace: true })}
            >
              Clear filters
            </Button>
          ) : (
            <Button asChild>
              <Link to="/recipes/new">New recipe</Link>
            </Button>
          )}
        </motion.div>
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial>
            {shown.map((recipe, index) => (
              <motion.div
                key={recipe.id}
                layout="position"
                className="h-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: 4,
                  transition: { duration: 0.16, ease: easeIn, delay: 0 },
                }}
                transition={{
                  duration: 0.28,
                  ease: easeOut,
                  delay: Math.min(index, 6) * 0.04,
                }}
              >
                <RecipeCard
                  recipe={recipe}
                  onFavorite={(id, favorite) =>
                    setRecipes(
                      (current) =>
                        current?.map((item) =>
                          item.id === id ? { ...item, favorite } : item
                        ) ?? current
                    )
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export { LibraryPage };
