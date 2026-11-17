import { LockIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { HeartMark } from "@/components/heart-mark";
import { Stars } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setFavorite } from "@/lib/api";
import { match } from "@/lib/result";
import { formatMinutes, totalMinutes } from "@/lib/format";
import type { Recipe } from "@/shared/recipe";

function RecipeCard({
  recipe,
  onFavorite,
}: {
  recipe: Recipe;
  onFavorite: (id: string, favorite: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const minutes = formatMinutes(
    totalMinutes(recipe.prepMinutes, recipe.cookMinutes)
  );

  const toggle = async () => {
    setPending(true);
    const result = await setFavorite(recipe.id);
    match(
      result,
      (value) => onFavorite(recipe.id, value.favorite),
      (error) => toast.error(error)
    );
    setPending(false);
  };

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Link
        to={`/recipes/${recipe.id}`}
        className="flex min-w-0 flex-1 flex-col outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {recipe.image ? (
          <img
            src={recipe.image}
            alt=""
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="aspect-[4/3] w-full bg-muted" />
        )}
        <div
          className={`flex flex-1 flex-col gap-3 p-4 ${recipe.tags.length > 0 ? "pb-0" : ""}`}
        >
          <div className="min-w-0 space-y-1 pr-8">
            <h2 className="flex items-center gap-1.5 text-base font-medium tracking-tight">
              <span className="min-w-0 truncate">{recipe.title}</span>
              {recipe.visibility === "private" && (
                <span
                  className="inline-flex shrink-0 text-muted-foreground"
                  title="Private"
                >
                  <LockIcon className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Private</span>
                </span>
              )}
            </h2>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
              <span>
                {[minutes, recipe.servings ? `${recipe.servings} servings` : null]
                  .filter(Boolean)
                  .join(" · ") || "No time set"}
              </span>
              {recipe.rating.average !== null && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <Stars value={recipe.rating.average} />
                  <span className="sr-only">Rated</span>
                  {recipe.rating.average.toFixed(1)}
                  <span className="sr-only">out of 5</span>
                </span>
              )}
            </p>
          </div>
        </div>
      </Link>
      {recipe.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 px-4 pt-3 pb-4">
          {recipe.tags.map((tag) => (
            <Badge key={tag} variant="secondary" asChild>
              <Link to={`/?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
            </Badge>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 z-10 bg-background/90"
        aria-pressed={recipe.favorite}
        aria-label={
          recipe.favorite
            ? `Remove ${recipe.title} from favorites`
            : `Favorite ${recipe.title}`
        }
        disabled={pending}
        onClick={toggle}
      >
        <HeartMark filled={recipe.favorite} />
      </Button>
    </article>
  );
}

export { RecipeCard };
