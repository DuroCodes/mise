import {
  ChefHatIcon,
  GlobeIcon,
  LockIcon,
  PencilIcon,
  PrinterIcon,
  ShoppingBasketIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AddToCollection } from "@/components/add-to-collection";
import { AddToPlan } from "@/components/add-to-plan";
import { AskClaude } from "@/components/ask-claude";
import { CookLog } from "@/components/cook-log";
import { DeleteRecipe } from "@/components/delete-recipe";
import { HeartMark } from "@/components/heart-mark";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { RecipeView } from "@/components/recipe-view";
import { ShareRecipe } from "@/components/share-recipe";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import {
  addRecipesToShopping,
  cachedRecipe,
  getRecipe,
  rateRecipe,
  setFavorite,
  setVisibility,
} from "@/lib/api";
import { match } from "@/lib/result";
import { useSession } from "@/lib/session-context";
import type { Measure } from "@/lib/units";
import { useTitle } from "@/lib/use-title";
import { saveMeasure, storedMeasure } from "@/lib/view";
import { NotFoundPage } from "@/pages/not-found";
import type { Recipe } from "@/shared/recipe";

function RecipeBody({
  recipe,
  onRecipe,
  onDeleted,
}: {
  recipe: Recipe;
  onRecipe: (recipe: Recipe) => void;
  onDeleted: () => void;
}) {
  const { account, ai } = useSession();
  const navigate = useNavigate();
  const [servings, setServings] = useState(recipe.servings ?? 1);
  const [system, setSystem] = useState<Measure>(storedMeasure);
  const [pending, setPending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rating, setRating] = useState(false);

  const chooseSystem = (measure: Measure) => {
    setSystem(measure);
    saveMeasure(measure);
  };

  const toggleFavorite = async () => {
    setPending(true);
    const result = await setFavorite(recipe.id);
    match(
      result,
      (value) => onRecipe({ ...recipe, favorite: value.favorite }),
      (error) => toast.error(error)
    );
    setPending(false);
  };

  const toggleVisibility = async () => {
    setSharing(true);
    const result = await setVisibility(recipe.id);
    match(
      result,
      (value) => onRecipe({ ...recipe, visibility: value.visibility }),
      (error) => toast.error(error)
    );
    setSharing(false);
  };

  const rate = async (stars: number | null) => {
    setRating(true);
    const result = await rateRecipe(recipe.id, stars);
    setRating(false);
    if (result.ok) onRecipe({ ...recipe, rating: result.value });
    else toast.error(result.error);
  };

  const addToList = async () => {
    setAdding(true);
    const result = await addRecipesToShopping(
      [{ recipeId: recipe.id, servings: recipe.servings ? servings : null }],
      system
    );
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Added to your shopping list", {
      action: { label: "View", onClick: () => navigate("/shopping") },
    });
  };

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
      onSystem={chooseSystem}
      byline={
        recipe.ownerName && recipe.ownerId !== account.id
          ? `by ${recipe.ownerName}`
          : null
      }
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-pressed={recipe.favorite}
            aria-label={
              recipe.favorite
                ? `Remove ${recipe.title} from favorites`
                : `Favorite ${recipe.title}`
            }
            disabled={pending}
            onClick={toggleFavorite}
          >
            <HeartMark filled={recipe.favorite} />
          </Button>
          <ShareRecipe
            recipeId={recipe.id}
            title={recipe.title}
            token={recipe.shareToken}
            onToken={(shareToken) => onRecipe({ ...recipe, shareToken })}
          />
          {recipe.canEdit && (
            <>
              {recipe.ownerId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-pressed={recipe.visibility === "public"}
                  aria-label={
                    recipe.visibility === "public"
                      ? `Make ${recipe.title} private`
                      : `Make ${recipe.title} public`
                  }
                  disabled={sharing}
                  onClick={toggleVisibility}
                >
                  {recipe.visibility === "public" ? (
                    <GlobeIcon />
                  ) : (
                    <LockIcon />
                  )}
                </Button>
              )}
              <Button asChild variant="outline" size="icon">
                <Link
                  to={`/recipes/${recipe.id}/edit`}
                  aria-label={`Edit ${recipe.title}`}
                >
                  <PencilIcon />
                </Link>
              </Button>
              <DeleteRecipe
                id={recipe.id}
                title={recipe.title}
                onDeleted={onDeleted}
              />
            </>
          )}
        </>
      }
      aside={
        <div className="print:hidden">
          <StarRating rating={recipe.rating} disabled={rating} onRate={rate} />
        </div>
      }
      toolbar={
        <>
          <Button asChild size="sm">
            <Link
              to={`/recipes/${recipe.id}/cook${cookQuery ? `?${cookQuery}` : ""}`}
            >
              <ChefHatIcon data-icon="inline-start" />
              <span className="sm:hidden">Cook</span>
              <span className="max-sm:hidden">Cook mode</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adding || !recipe.ingredients.length}
            aria-busy={adding}
            onClick={addToList}
          >
            <motion.span
              className="inline-flex"
              animate={adding ? { rotate: [0, -8, 6, 0] } : { rotate: 0 }}
              transition={
                adding
                  ? { duration: 0.6, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
              }
            >
              <ShoppingBasketIcon data-icon="inline-start" />
            </motion.span>
            <span className="sm:hidden">Shopping</span>
            <span className="max-sm:hidden">Shopping list</span>
          </Button>
          <AddToPlan
            recipeId={recipe.id}
            servings={recipe.servings ? servings : null}
          />
          <AddToCollection recipeId={recipe.id} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <PrinterIcon data-icon="inline-start" />
            Print
          </Button>
        </>
      }
    >
      <CookLog
        recipeId={recipe.id}
        selfId={account.id}
        isAdmin={account.role === "admin"}
        onChange={(entries) =>
          onRecipe({
            ...recipe,
            cookCount: entries.length,
            lastCooked: entries[0]?.cookedOn ?? null,
          })
        }
      />
      {ai && recipe.ingredients.length > 0 && (
        <AskClaude recipeId={recipe.id} />
      )}
    </RecipeView>
  );
}

function RecipePage() {
  const { id } = useParams();
  if (!id) return <NotFoundPage />;
  return <RecipeScreen key={id} id={id} />;
}

function RecipeScreen({ id }: { id: string }) {
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(() => cachedRecipe(id));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    getRecipe(id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (!cachedRecipe(id)) setMissing(true);
        return;
      }
      setRecipe(result.value);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useTitle(recipe ? `${recipe.title} · Mise` : "Mise");

  if (missing) return <NotFoundPage />;
  if (!recipe) return <RecipePlaceholder />;

  return (
    <RecipeBody
      key={recipe.id}
      recipe={recipe}
      onRecipe={setRecipe}
      onDeleted={() => navigate("/")}
    />
  );
}

export { RecipePage };
