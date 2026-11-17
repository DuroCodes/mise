import { GlobeIcon, LockIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { HeartMark } from "@/components/heart-mark";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { AiRecipe } from "@/components/ai-recipe";
import { ImportButton } from "@/components/import-recipe";
import {
  IngredientList,
  InstructionList,
  type IngredientDraft,
  type InstructionDraft,
} from "@/components/line-list";
import { TagField } from "@/components/tag-field";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import {
  cachedRecipe,
  createRecipe,
  discardUpload,
  aiRecipeFromUrl,
  getRecipe,
  importRecipe,
  updateRecipe,
  uploadImage,
} from "@/lib/api";
import { receivedKey } from "@/lib/bookmarklet";
import { sourceHost } from "@/lib/view";
import { match } from "@/lib/result";
import { useSession } from "@/lib/session-context";
import { useTitle } from "@/lib/use-title";
import { NotFoundPage } from "@/pages/not-found";
import { easeOut } from "@/lib/motion";
import { unitValue } from "@/lib/units";
import {
  isReservedTag,
  recipeInput,
  type Recipe,
  type RecipeInput,
} from "@/shared/recipe";

type Draft = {
  title: string;
  description: string;
  image: string;
  sourceUrl: string;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  favorite: boolean;
  visibility: "private" | "public";
  tags: string[];
  ingredients: IngredientDraft[];
  instructions: InstructionDraft[];
};

const emptyIngredient = (): IngredientDraft => ({
  key: crypto.randomUUID(),
  amount: "",
  unit: "",
  name: "",
  note: "",
});

const draftFromInput = (imported: RecipeInput): Draft => ({
  title: imported.title,
  description: imported.description,
  image: imported.image ?? "",
  sourceUrl: imported.sourceUrl ?? "",
  prepMinutes: imported.prepMinutes?.toString() ?? "",
  cookMinutes: imported.cookMinutes?.toString() ?? "",
  servings: imported.servings?.toString() ?? "",
  favorite: false,
  visibility: "private",
  tags: imported.tags,
  ingredients: imported.ingredients.length
    ? imported.ingredients.map((item) => ({
        key: crypto.randomUUID(),
        ...item,
        unit: unitValue(item.unit),
      }))
    : [emptyIngredient()],
  instructions: imported.instructions.length
    ? imported.instructions.map((item) => ({
        key: crypto.randomUUID(),
        text: item.text,
      }))
    : [{ key: crypto.randomUUID(), text: "" }],
});

/** A recipe handed over by "Send to Mise", used once and then cleared. */
const receivedDraft = (): Draft | null => {
  if (new URLSearchParams(window.location.search).get("received") !== "1")
    return null;
  try {
    const raw = sessionStorage.getItem(receivedKey);
    if (!raw) return null;
    const parsed = recipeInput.safeParse(JSON.parse(raw));
    return parsed.success ? draftFromInput(parsed.data) : null;
  } catch {
    return null;
  }
};

const draftFrom = (recipe: Recipe | null): Draft => ({
  title: recipe?.title ?? "",
  description: recipe?.description ?? "",
  image: recipe?.image ?? "",
  sourceUrl: recipe?.sourceUrl ?? "",
  prepMinutes: recipe?.prepMinutes?.toString() ?? "",
  cookMinutes: recipe?.cookMinutes?.toString() ?? "",
  servings: recipe?.servings?.toString() ?? "",
  favorite: recipe?.favorite ?? false,
  visibility: recipe?.visibility ?? "private",
  tags: recipe?.tags ?? [],
  ingredients: recipe?.ingredients.length
    ? recipe.ingredients.map((item) => ({ key: crypto.randomUUID(), ...item }))
    : [emptyIngredient()],
  instructions: recipe?.instructions.length
    ? recipe.instructions.map((item) => ({
        key: crypto.randomUUID(),
        text: item.text,
      }))
    : [{ key: crypto.randomUUID(), text: "" }],
});

const readCount = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
};

const fieldErrors = (issues: { path: PropertyKey[]; message: string }[]) => {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    fields[key] ??= issue.message;
  }
  return fields;
};

function CountField({
  id,
  label,
  value,
  min,
  max,
  invalid,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  invalid: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const parsed = value.trim() === "" ? null : Number(value);

  return (
    <div className="space-y-2">
      <NumberField
        id={id}
        min={min}
        max={max}
        format={{ maximumFractionDigits: 0 }}
        value={parsed !== null && Number.isFinite(parsed) ? parsed : null}
        onValueChange={(next) => onChange(next === null ? "" : String(next))}
      >
        <NumberFieldScrubArea label={label} />
        <NumberFieldGroup aria-invalid={invalid}>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function RecipeForm({ recipe }: { recipe: Recipe | null }) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(
    () => (recipe ? null : receivedDraft()) ?? draftFrom(recipe)
  );
  const { ai } = useSession();
  const [params, setParams] = useSearchParams();
  const [tagDraft, setTagDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const patch = (next: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...next }));

  const fillFrom = (imported: RecipeInput) => {
    setErrors({});
    setDraft(draftFromInput(imported));
  };

  // A link import while this page is already open arrives as ?n=. The first
  // visit still reads the draft in the state initializer above.
  const nonce = params.get("n");
  const [appliedNonce, setAppliedNonce] = useState<string | null>(null);
  if (!recipe && nonce && nonce !== appliedNonce) {
    setAppliedNonce(nonce);
    const incoming = receivedDraft();
    if (incoming) {
      setErrors({});
      setDraft(incoming);
    }
  }

  // Arrived from "Send to Mise" or a link import: the draft was loaded above.
  useEffect(() => {
    if (params.get("received") !== "1") return;
    try {
      sessionStorage.removeItem(receivedKey);
    } catch {
      // Nothing to clean up.
    }
    const next = new URLSearchParams(params);
    next.delete("received");
    next.delete("n");
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Opened from "Import" on a Claude search result: fill the form from that page.
  const importUrl = recipe ? null : params.get("import");
  const [importing, setImporting] = useState<string | null>(importUrl);
  // Read inside the import effect without restarting it when it loads.
  const aiRef = useRef(ai);
  useEffect(() => {
    aiRef.current = ai;
  }, [ai]);
  useEffect(() => {
    if (!importUrl) return;
    let active = true;
    importRecipe(importUrl).then((result) => {
      if (!active) return;
      setImporting(null);
      if (result.ok) fillFrom(result.value);
      else
        toast.error(result.error, {
          duration: 10_000,
          action: aiRef.current
            ? {
                label: "Try with AI",
                onClick: () => {
                  setImporting(importUrl);
                  void aiRecipeFromUrl(importUrl).then((retry) => {
                    setImporting(null);
                    if (retry.ok) fillFrom(retry.value);
                    else toast.error(retry.error);
                  });
                },
              }
            : undefined,
        });
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("import");
          return next;
        },
        { replace: true }
      );
    });
    return () => {
      active = false;
    };
  }, [importUrl, setParams]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const previous = draft.image;
    const uploaded = await uploadImage(file);
    if (!uploaded.ok) toast.error(uploaded.error);
    else {
      if (previous.startsWith("/uploads/") && previous !== recipe?.image)
        await discardUpload(previous);
      patch({ image: uploaded.value.url });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prepMinutes = readCount(draft.prepMinutes);
    const cookMinutes = readCount(draft.cookMinutes);
    const servings = readCount(draft.servings);
    const local: Record<string, string> = {};
    if (
      Number.isNaN(prepMinutes) ||
      (prepMinutes !== null && prepMinutes > 1440)
    ) {
      local.prepMinutes = "Use whole minutes, up to 1440";
    }
    if (
      Number.isNaN(cookMinutes) ||
      (cookMinutes !== null && cookMinutes > 1440)
    ) {
      local.cookMinutes = "Use whole minutes, up to 1440";
    }
    if (
      Number.isNaN(servings) ||
      (servings !== null && (servings < 1 || servings > 999))
    ) {
      local.servings = "Servings should be from 1 to 999";
    }
    if ([...draft.tags, tagDraft].some((tag) => isReservedTag(tag))) {
      local.tags = "Favorites is not a tag";
    }

    const ingredients = draft.ingredients
      .map(({ amount, unit, name, note }) => ({
        amount: amount.trim(),
        unit: unit.trim(),
        name: name.trim(),
        note: note.trim(),
      }))
      .filter((item) => item.amount || item.unit || item.name || item.note);

    const instructions = draft.instructions
      .map((item) => ({ text: item.text.trim() }))
      .filter((item) => item.text);

    const parsed = recipeInput.safeParse({
      title: draft.title,
      description: draft.description,
      image: draft.image.trim() || null,
      sourceUrl: draft.sourceUrl.trim() || null,
      prepMinutes: Number.isNaN(prepMinutes) ? null : prepMinutes,
      cookMinutes: Number.isNaN(cookMinutes) ? null : cookMinutes,
      servings: Number.isNaN(servings) ? null : servings,
      favorite: draft.favorite,
      visibility: draft.visibility,
      tags: tagDraft.trim() ? [...draft.tags, tagDraft] : draft.tags,
      ingredients,
      instructions,
    });

    const nextErrors = {
      ...local,
      ...(parsed.success ? {} : fieldErrors(parsed.error.issues)),
    };

    if (!parsed.success || Object.keys(local).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    const saved = recipe
      ? await updateRecipe(recipe.id, parsed.data)
      : await createRecipe(parsed.data);
    match(
      saved,
      (value) => navigate(`/recipes/${value.id}`),
      (error) => {
        toast.error(error);
        setSaving(false);
      }
    );
  };

  return (
    <form onSubmit={save} className="space-y-8" noValidate>
      {importing && (
        <p
          className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground"
          aria-live="polite"
        >
          Importing the recipe from {sourceHost(importing)}…
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight">
          {recipe ? "Edit recipe" : "New recipe"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {!recipe && <ImportButton onImported={fillFrom} />}
          {!recipe && ai && <AiRecipe onImported={fillFrom} />}
          {(!recipe || recipe.ownerId) && (
            <Button
              type="button"
              variant={draft.visibility === "public" ? "default" : "outline"}
              aria-pressed={draft.visibility === "public"}
              onClick={() =>
                patch({
                  visibility:
                    draft.visibility === "public" ? "private" : "public",
                })
              }
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={draft.visibility}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: easeOut }}
                  className="inline-flex items-center gap-1.5"
                >
                  {draft.visibility === "public" ? (
                    <GlobeIcon data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <LockIcon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {draft.visibility === "public" ? "Public" : "Private"}
                </motion.span>
              </AnimatePresence>
            </Button>
          )}
          <Button
            type="button"
            className="border-border dark:border-input"
            variant={draft.favorite ? "secondary" : "outline"}
            aria-pressed={draft.favorite}
            onClick={() => patch({ favorite: !draft.favorite })}
          >
            <HeartMark filled={draft.favorite} />
            {draft.favorite ? "Favorited" : "Favorite"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={draft.title}
            aria-invalid={Boolean(errors.title)}
            onChange={(event) => patch({ title: event.target.value })}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source-url">Source link</Label>
          <Input
            id="source-url"
            type="url"
            inputMode="url"
            value={draft.sourceUrl}
            placeholder="https:// where the recipe came from"
            aria-invalid={Boolean(errors.sourceUrl)}
            onChange={(event) => patch({ sourceUrl: event.target.value })}
          />
          {errors.sourceUrl && (
            <p className="text-sm text-destructive">{errors.sourceUrl}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <CountField
            id="prep"
            label="Prep minutes"
            value={draft.prepMinutes}
            min={0}
            max={1440}
            invalid={Boolean(errors.prepMinutes)}
            error={errors.prepMinutes}
            onChange={(prepMinutes) => patch({ prepMinutes })}
          />
          <CountField
            id="cook"
            label="Cook minutes"
            value={draft.cookMinutes}
            min={0}
            max={1440}
            invalid={Boolean(errors.cookMinutes)}
            error={errors.cookMinutes}
            onChange={(cookMinutes) => patch({ cookMinutes })}
          />
          <CountField
            id="servings"
            label="Servings"
            value={draft.servings}
            min={1}
            max={999}
            invalid={Boolean(errors.servings)}
            error={errors.servings}
            onChange={(servings) => patch({ servings })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Image</Label>
        {draft.image && (
          <img
            src={draft.image}
            alt=""
            className="h-48 w-full rounded-xl object-cover ring-1 ring-foreground/10 sm:h-64"
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="image"
            className="min-w-0 flex-1"
            value={draft.image}
            placeholder="https:// or an uploaded file"
            aria-invalid={Boolean(errors.image)}
            onChange={(event) => patch({ image: event.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading" : "Upload"}
          </Button>
          {draft.image && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => patch({ image: "" })}
            >
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </div>
        {errors.image && (
          <p className="text-sm text-destructive">{errors.image}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tag">Tags</Label>
        {draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="rounded-4xl bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                onClick={() =>
                  patch({ tags: draft.tags.filter((item) => item !== tag) })
                }
              >
                {tag}
                <span aria-hidden="true"> ×</span>
                <span className="sr-only">, remove</span>
              </button>
            ))}
          </div>
        )}
        <TagField
          tags={draft.tags}
          draft={tagDraft}
          onTags={(tags) => patch({ tags })}
          onDraft={setTagDraft}
        />
        {errors.tags && (
          <p className="text-sm text-destructive">{errors.tags}</p>
        )}
      </div>

      <IngredientList
        items={draft.ingredients}
        errors={errors}
        onChange={(ingredients) => patch({ ingredients })}
      />
      <InstructionList
        items={draft.instructions}
        errors={errors}
        onChange={(instructions) => patch({ instructions })}
      />

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button asChild variant="outline" type="button">
          <Link to={recipe ? `/recipes/${recipe.id}` : "/"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EditorPage() {
  const { id } = useParams();
  return <EditorScreen key={id ?? "new"} id={id} />;
}

function EditorScreen({ id }: { id: string | undefined }) {
  const cached = id ? cachedRecipe(id) : null;
  const [recipe, setRecipe] = useState<Recipe | null>(cached);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    id && !cached ? "loading" : "ready"
  );

  useTitle(id ? "Edit recipe · Mise" : "New recipe · Mise");

  useEffect(() => {
    if (!id) return;
    let active = true;
    getRecipe(id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        if (!cachedRecipe(id)) setState("missing");
        return;
      }
      setRecipe(result.value);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (state === "loading") return <RecipePlaceholder />;
  if (state === "missing") return <NotFoundPage />;
  if (recipe && !recipe.canEdit) {
    return (
      <div className="space-y-3 py-10">
        <h1 className="text-2xl font-medium tracking-tight">
          Only {recipe.ownerName ?? "the owner"} can edit this
        </h1>
        <Button asChild variant="outline">
          <Link to={`/recipes/${recipe.id}`}>Back to the recipe</Link>
        </Button>
      </div>
    );
  }
  return <RecipeForm key={recipe?.id ?? "new"} recipe={recipe} />;
}

export { EditorPage };
