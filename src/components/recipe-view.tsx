import {
  CarrotIcon,
  ChevronDownIcon,
  DropletIcon,
  DrumstickIcon,
  ExternalLinkIcon,
  FlameIcon,
  LeafIcon,
  ListOrderedIcon,
  LockIcon,
  WheatIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "cn";
import { StepText } from "@/components/step-text";
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
import { formatMinutes, ingredientLine } from "@/lib/format";
import { easeOut } from "@/lib/motion";
import { scaleIngredient, type Measure } from "@/lib/units";
import { parenthetical, sourceHost } from "@/lib/view";
import { estimateNutrition } from "@/shared/nutrition";
import type { SharedRecipe } from "@/shared/recipe";

export type ViewRecipe = SharedRecipe & {
  visibility?: "private" | "public";
};

const measures = [
  { id: "original", label: "Original", short: "Original" },
  { id: "metric", label: "Metric", short: "Metric" },
  { id: "imperial", label: "Imperial", short: "US" },
] as const;

const round = (value: number) =>
  value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

function NutritionPanel({ recipe }: { recipe: ViewRecipe }) {
  const [open, setOpen] = useState(false);
  if (!recipe.ingredients.length) return null;
  const estimate = estimateNutrition(recipe.ingredients, recipe.servings);
  const figures = estimate.perServing ?? estimate.total;
  const label = estimate.perServing ? "per serving" : "whole recipe";
  if (!estimate.counted.length) return null;
  const missing = [...estimate.unmeasured, ...estimate.unknown];

  return (
    <section className="min-w-0 space-y-2 print:break-inside-avoid">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring print:pointer-events-none"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <h2 className="text-sm font-medium">
          Nutrition{" "}
          <span className="font-normal text-muted-foreground">
            · about {Math.round(figures.kcal)} kcal {label}
          </span>
        </h2>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform print:hidden",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <div className={cn("space-y-3", open ? "block" : "hidden print:block")}>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              [FlameIcon, "Calories", `${Math.round(figures.kcal)}`],
              [DrumstickIcon, "Protein", `${round(figures.protein)} g`],
              [WheatIcon, "Carbs", `${round(figures.carbs)} g`],
              [DropletIcon, "Fat", `${round(figures.fat)} g`],
              [LeafIcon, "Fiber", `${round(figures.fiber)} g`],
            ] as const
          ).map(([Icon, name, value]) => (
            <div
              key={name}
              className="rounded-lg bg-muted/60 px-3 py-2 print:bg-transparent print:px-0"
            >
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5 print:hidden" aria-hidden="true" />
                {name}
              </dt>
              <dd className="text-base font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          Estimate from {estimate.counted.length} of {recipe.ingredients.length}{" "}
          ingredients.
          {missing.length > 0 && ` Skipped: ${missing.join(", ")}.`}
        </p>
      </div>
    </section>
  );
}

function RecipeView({
  recipe,
  servings,
  onServings,
  system,
  onSystem,
  actions,
  byline,
  aside,
  toolbar,
  children,
}: {
  recipe: ViewRecipe;
  servings: number;
  onServings: (value: number) => void;
  system: Measure;
  onSystem: (measure: Measure) => void;
  actions?: ReactNode;
  byline?: ReactNode;
  aside?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
}) {
  const [brokenImage, setBrokenImage] = useState(false);
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
    recipe.servings !== null ? `serves ${recipe.servings}` : null,
  ].filter((item): item is string => Boolean(item));

  const setCount = (next: number) => {
    if (!Number.isFinite(next)) return;
    const rounded = Math.round(next * 100) / 100;
    if (rounded < 0.5 || rounded > 999) return;
    onServings(rounded);
  };

  return (
    <motion.article
      className="w-full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOut }}
    >
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          {actions && (
            <div className="flex shrink-0 items-center gap-1 sm:order-last print:hidden">
              {actions}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-medium tracking-tight text-balance">
              {recipe.title}
              {recipe.visibility === "private" && (
                <>
                  <LockIcon
                    className="ml-2 inline-block size-5 -translate-y-0.5 text-muted-foreground print:hidden"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Private</span>
                </>
              )}
            </h1>
            {(byline || recipe.sourceUrl) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {byline && <span>{byline}</span>}
                {byline && recipe.sourceUrl && (
                  <span aria-hidden="true">·</span>
                )}
                {recipe.sourceUrl && (
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    <span className="print:hidden">View original on </span>
                    <span className="hidden print:inline">From </span>
                    {sourceHost(recipe.sourceUrl)}
                    <ExternalLinkIcon
                      className="ml-1 inline size-3.5 align-[-0.125em] print:hidden"
                      aria-hidden="true"
                    />
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 print:hidden">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary" asChild>
                <Link to={`/?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
              </Badge>
            ))}
          </div>
        )}
        {recipe.description && (
          <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">
            {recipe.description}
          </p>
        )}
        {meta.length > 0 && (
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        )}
        {aside}
        {toolbar && (
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto pt-1 sm:flex-wrap sm:gap-2 print:hidden">
            {toolbar}
          </div>
        )}
      </header>

      {recipe.image && !brokenImage && (
        <motion.img
          src={recipe.image}
          alt=""
          className="mt-4 h-48 w-full rounded-xl object-cover ring-1 ring-foreground/10 sm:h-64 print:hidden"
          initial={{ opacity: 0, scale: 1.015 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: easeOut, delay: 0.06 }}
          onError={() => setBrokenImage(true)}
        />
      )}

      <div className="mt-5 space-y-6 border-t pt-5 print:mt-4 print:space-y-5 print:pt-4">
        <section className="min-w-0 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            <h2 className="text-sm font-medium">
              Ingredients
              {recipe.servings !== null && servings !== recipe.servings && (
                <span className="hidden font-normal print:inline">
                  {" "}
                  (for {servings})
                </span>
              )}
            </h2>
            <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto print:hidden">
              {recipe.servings !== null && (
                <NumberField
                  className="w-auto shrink-0 flex-row items-center"
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
                  <NumberFieldGroup className="w-24">
                    <NumberFieldDecrement />
                    <NumberFieldInput />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              )}
              {recipe.ingredients.length > 0 && (
                <div
                  className="flex shrink-0 gap-1"
                  role="group"
                  aria-label="Units"
                >
                  {measures.map((measure) => (
                    <Button
                      key={measure.id}
                      type="button"
                      size="sm"
                      className="rounded-lg px-2 sm:px-2.5"
                      variant={system === measure.id ? "default" : "outline"}
                      aria-label={measure.label}
                      aria-pressed={system === measure.id}
                      onClick={() => onSystem(measure.id)}
                    >
                      <span className="sm:hidden">{measure.short}</span>
                      <span className="max-sm:hidden">{measure.label}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {!ingredients.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CarrotIcon className="size-4" aria-hidden="true" />
              No ingredients yet.
            </p>
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
        <section className="min-w-0 space-y-2">
          <h2 className="text-sm font-medium">Instructions</h2>
          {!recipe.instructions.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListOrderedIcon className="size-4" aria-hidden="true" />
              No steps yet.
            </p>
          ) : (
            <ol className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-sm leading-6">
              {recipe.instructions.map((item, index) => (
                <li
                  key={`${index}-${item.text.slice(0, 12)}`}
                  className="contents"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 break-inside-avoid">
                    <StepText
                      text={item.text}
                      step={index + 1}
                      recipe={recipe.title}
                      measure={system}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <NutritionPanel recipe={recipe} />
        {children}
      </div>
    </motion.article>
  );
}

export { RecipeView };
