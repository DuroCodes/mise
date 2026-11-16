import { LockIcon, PencilIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { HeartMark } from "@/components/heart-mark";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { DeleteRecipe } from "@/components/delete-recipe";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@/components/ui/number-field";
import { cachedRecipe, getRecipe, setFavorite } from "@/lib/api";
import { formatMinutes, ingredientLine } from "@/lib/format";
import { match } from "@/lib/result";
import { easeOut } from "@/lib/motion";
import { scaleIngredient, type Measure } from "@/lib/units";
import { useTitle } from "@/lib/use-title";
import { NotFoundPage } from "@/pages/not-found";
import type { Recipe } from "@/shared/recipe";

const measures: { id: Measure; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "metric", label: "Metric" },
  { id: "imperial", label: "Imperial" },
];

const parenthetical = (note: string) => {
  const trimmed = note.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return trimmed;
  return `(${trimmed})`;
};

const storedMeasure = (): Measure => {
  const stored = localStorage.getItem("mise-units");
  if (stored === "metric" || stored === "imperial" || stored === "original")
    return stored;
  return "original";
};

function RecipeBody({
  recipe,
  pending,
  brokenImage,
  onBrokenImage,
  onToggle,
  onDeleted,
  system,
  onSystem,
}: {
  recipe: Recipe;
  pending: boolean;
  brokenImage: boolean;
  onBrokenImage: () => void;
  onToggle: () => void;
  onDeleted: () => void;
  system: Measure;
  onSystem: (measure: Measure) => void;
}) {
  const [servings, setServings] = useState(recipe.servings ?? 1);
  const factor = recipe.servings ? servings / recipe.servings : 1;
  const ingredients = recipe.ingredients.map((item) =>
    scaleIngredient(item, factor, system)
  );

  const meta = [
    recipe.prepMinutes !== null
      ? `${formatMinutes(recipe.prepMinutes)} prep`
      : null,
    recipe.cookMinutes !== null
      ? `${formatMinutes(recipe.cookMinutes)} cook`
      : null,
  ].filter((item): item is string => Boolean(item));

  const setCount = (next: number) => {
    if (!Number.isFinite(next)) return;
    const rounded = Math.round(next * 100) / 100;
    if (rounded < 0.5 || rounded > 999) return;
    setServings(rounded);
  };

  return (
    <motion.article
      className="w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOut }}
    >
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-medium tracking-tight text-balance">
            {recipe.title}
            {recipe.visibility === "private" && (
              <>
                <LockIcon
                  className="ml-2 inline-block size-5 -translate-y-0.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="sr-only">Private</span>
              </>
            )}
          </h1>
          {recipe.canEdit && (
            <div className="flex shrink-0 items-center gap-1">
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
                onClick={onToggle}
              >
                <HeartMark filled={recipe.favorite} />
              </Button>
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
            </div>
          )}
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {recipe.description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {recipe.description}
          </p>
        )}
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
      </header>

      {recipe.image && !brokenImage && (
        <motion.img
          src={recipe.image}
          alt=""
          className="mt-6 h-48 w-full rounded-xl object-cover ring-1 ring-foreground/10 sm:h-64"
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.06 }}
          onError={onBrokenImage}
        />
      )}

      <div className="mt-8 space-y-10 border-t pt-8">
        <section className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-sm font-medium">Ingredients</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {recipe.servings !== null && (
                <div className="flex items-center gap-1.5">
                  <NumberField
                    className="w-auto flex-row items-center"
                    size="sm"
                    min={0.5}
                    max={999}
                    format={{ maximumFractionDigits: 2 }}
                    value={servings}
                    onValueChange={(value) => {
                      if (value === null) return;
                      setCount(value);
                    }}
                  >
                    <NumberFieldScrubArea
                      label="Servings"
                      className="text-muted-foreground **:data-[slot=label]:font-normal"
                    />
                    <NumberFieldGroup className="w-28">
                      <NumberFieldDecrement />
                      <NumberFieldInput />
                      <NumberFieldIncrement />
                    </NumberFieldGroup>
                  </NumberField>
                </div>
              )}
              {recipe.ingredients.length > 0 && (
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Units"
                >
                  {measures.map((measure) => (
                    <Button
                      key={measure.id}
                      type="button"
                      size="sm"
                      className="rounded-lg"
                      variant={system === measure.id ? "default" : "outline"}
                      aria-pressed={system === measure.id}
                      onClick={() => onSystem(measure.id)}
                    >
                      {measure.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients yet.</p>
          ) : (
            <ul className="text-sm leading-6 md:columns-2 md:gap-x-8">
              {ingredients.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="mb-1.5 flex break-inside-avoid gap-1.5"
                >
                  <span
                    className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-foreground/70"
                    aria-hidden="true"
                  />
                  <p className="min-w-0">
                    {ingredientLine(item)}
                    {item.note.trim() && (
                      <span className="text-muted-foreground">
                        {" "}
                        {parenthetical(item.note)}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="min-w-0 space-y-3">
          <h2 className="text-sm font-medium">Instructions</h2>
          {recipe.instructions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          ) : (
            <ol className="space-y-1.5 text-sm leading-6">
              {recipe.instructions.map((item, index) => (
                <li
                  key={`${index}-${item.text.slice(0, 12)}`}
                  className="flex gap-3"
                >
                  <span className="w-5 shrink-0 text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0">{item.text}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </motion.article>
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
  const [brokenImage, setBrokenImage] = useState(false);
  const [pending, setPending] = useState(false);
  const [system, setSystem] = useState<Measure>(storedMeasure);

  useEffect(() => {
    let active = true;
    getRecipe(id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (!cachedRecipe(id)) setMissing(true);
        return;
      }
      setRecipe(result.value);
      setBrokenImage(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useTitle(recipe ? `${recipe.title} · Mise` : "Mise");

  const chooseSystem = (measure: Measure) => {
    setSystem(measure);
    localStorage.setItem("mise-units", measure);
  };

  if (missing) return <NotFoundPage />;
  if (!recipe) return <RecipePlaceholder />;

  const toggle = async () => {
    setPending(true);
    const result = await setFavorite(recipe.id);
    match(
      result,
      (value) => setRecipe({ ...recipe, favorite: value.favorite }),
      (error) => toast.error(error)
    );
    setPending(false);
  };

  return (
    <RecipeBody
      key={recipe.id}
      recipe={recipe}
      pending={pending}
      brokenImage={brokenImage}
      onBrokenImage={() => setBrokenImage(true)}
      onToggle={toggle}
      onDeleted={() => navigate("/")}
      system={system}
      onSystem={chooseSystem}
    />
  );
}

export { RecipePage };
