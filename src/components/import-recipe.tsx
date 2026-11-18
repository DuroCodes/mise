import {
  FileUpIcon,
  ImageIcon,
  Link2Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  aiRecipe,
  aiRecipeFromUrl,
  importFile,
  importRecipe,
  previewImportFile,
  type ImportResult,
} from "@/lib/api";
import { receivedKey } from "@/lib/bookmarklet";
import { shrinkPhoto } from "@/lib/images";
import { match } from "@/lib/result";
import { useSession } from "@/lib/session-context";
import type { RecipeInput } from "@/shared/recipe";
import { isReelUrl } from "@/shared/reel";

const fileExt = (name: string) => (
  <span className="font-mono text-[0.8em]">{name}</span>
);

const sources = [
  {
    name: "Paprika",
    help: <>{fileExt(".paprikarecipes")} export</>,
  },
  {
    name: "Mealie",
    help: (
      <>
        Export or backup ({fileExt(".zip")} / {fileExt(".json")})
      </>
    ),
  },
  {
    name: "Anything else",
    help: (
      <>
        Recipe {fileExt(".json")} (JSON-LD) or saved {fileExt(".html")} page
      </>
    ),
  },
];

const acceptedPhotos = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (recipe: RecipeInput) => void;
}) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [ready, setReady] = useState<{
    file: File;
    titles: string[];
    skipped: string[];
  } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { ai } = useSession();

  const reset = () => {
    setUrl("");
    setText("");
    setPhoto(null);
    setError(null);
    setFailedUrl(null);
    setResult(null);
    setReady(null);
    setFileName(null);
    setDragOver(false);
    setPending(false);
  };

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const fillFromLink = (recipe: RecipeInput) => {
    if (onImported) {
      reset();
      onOpenChange(false);
      onImported(recipe);
      return;
    }
    try {
      sessionStorage.setItem(receivedKey, JSON.stringify(recipe));
    } catch {
      setError("Could not keep that recipe for the form");
      setPending(false);
      return;
    }
    reset();
    onOpenChange(false);
    navigate(`/recipes/new?received=1&n=${Date.now()}`);
  };

  const tryClaude = async () => {
    if (!failedUrl) return;
    setPending(true);
    setError(null);
    const retry = await aiRecipeFromUrl(failedUrl);
    if (retry.ok) fillFromLink(retry.value);
    else {
      setError(retry.error);
      setPending(false);
    }
  };

  const submitUrl = async (event?: SubmitEvent<HTMLFormElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    const link = url.trim();
    if (!link) {
      setError("Paste a recipe link");
      return;
    }
    setPending(true);
    setError(null);
    setFailedUrl(null);
    setResult(null);
    setReady(null);
    if (ai && isReelUrl(link)) {
      const imported = await aiRecipeFromUrl(link);
      match(imported, fillFromLink, (message) => {
        setError(message);
        setPending(false);
      });
      return;
    }
    const imported = await importRecipe(link);
    match(imported, fillFromLink, (message) => {
      setError(message);
      setPending(false);
      if (/^https?:\/\//i.test(link)) setFailedUrl(link);
    });
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo");
      return;
    }
    const next = await shrinkPhoto(file);
    if (!acceptedPhotos.includes(next.type)) {
      setError("Use a JPEG, PNG, GIF, or WebP photo");
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("That photo is too large");
      return;
    }
    setError(null);
    setPhoto(next);
  };

  const submitText = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!text.trim() && !photo) {
      setError("Paste a recipe or add a photo");
      return;
    }
    setPending(true);
    setError(null);
    setFailedUrl(null);
    setResult(null);
    setReady(null);
    const result = await aiRecipe(text, photo);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    fillFromLink(result.value);
  };

  const upload = async (file: File | undefined) => {
    if (!file || pending) return;
    setPending(true);
    setFileName(file.name);
    setError(null);
    setResult(null);
    setFailedUrl(null);
    setReady(null);
    const response = await previewImportFile(file);
    setPending(false);
    setFileName(null);
    if (input.current) input.current.value = "";
    if (!response.ok) {
      setError(response.error);
      return;
    }
    if (response.value.recipe) {
      fillFromLink(response.value.recipe);
      return;
    }
    if (response.value.titles.length === 0) {
      setError(response.value.skipped[0] ?? "No recipes found in that file");
      return;
    }
    setReady({
      file,
      titles: response.value.titles,
      skipped: response.value.skipped,
    });
  };

  const commitFile = async () => {
    if (!ready || pending) return;
    setPending(true);
    setFileName(ready.file.name);
    setError(null);
    const response = await importFile(ready.file);
    setPending(false);
    setFileName(null);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setReady(null);
    setResult(response.value);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Import</DialogTitle>
          <DialogDescription>
            Link, text, photo, or a file from another app.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitUrl} noValidate>
          <div className="space-y-2">
            <Label htmlFor="import-url">Recipe link</Label>
            <div className="flex items-center gap-2">
              <Input
                id="import-url"
                type="url"
                inputMode="url"
                value={url}
                placeholder="https://"
                autoComplete="off"
                disabled={pending}
                aria-invalid={
                  failedUrl !== null || error === "Paste a recipe link"
                }
                onChange={(event) => setUrl(event.target.value)}
                className="min-w-0 flex-1"
              />
              <Button type="submit" disabled={pending} className="shrink-0">
                <Link2Icon data-icon="inline-start" />
                {pending && !fileName && !text && !photo
                  ? "Importing"
                  : "Fill the form"}
              </Button>
            </div>
          </div>
        </form>

        {ai && (
          <form
            onSubmit={submitText}
            className="space-y-3 border-t pt-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="import-text">Or paste text / add a photo</Label>
              <Textarea
                id="import-text"
                value={text}
                rows={5}
                maxLength={60000}
                className="max-h-[30svh] overflow-y-auto"
                placeholder="Paste the ingredients and steps"
                disabled={pending}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => photoRef.current?.click()}
              >
                <ImageIcon data-icon="inline-start" />
                {photo ? "Change photo" : "Add a photo"}
              </Button>
              {photo && (
                <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                  <span className="truncate">{photo.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove photo"
                    onClick={() => setPhoto(null)}
                  >
                    <XIcon />
                  </Button>
                </span>
              )}
              <Button type="submit" size="sm" disabled={pending}>
                <SparklesIcon data-icon="inline-start" />
                {pending && (text.trim() || photo) ? "Reading" : "Read with AI"}
              </Button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  void choosePhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
          </form>
        )}

        {error && failedUrl && ai && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void tryClaude()}
          >
            <SparklesIcon data-icon="inline-start" />
            {pending ? "Reading" : "Try with AI"}
          </Button>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-3 border-t pt-4">
          <ul className="grid gap-2 sm:grid-cols-3">
            {sources.map(({ name, help }) => (
              <li
                key={name}
                className="rounded-lg bg-muted/60 px-3 py-2 text-sm"
              >
                <p className="font-medium">{name}</p>
                <p className="mt-0.5 text-muted-foreground">{help}</p>
              </li>
            ))}
          </ul>
          <div
            className={
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
              (dragOver ? "border-brand bg-brand/5" : "border-border")
            }
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void upload(event.dataTransfer.files[0]);
            }}
          >
            <FileUpIcon
              className="size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {fileName ? `Reading ${fileName}…` : "Drop a file here, or"}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => input.current?.click()}
            >
              Choose a file
            </Button>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept=".paprikarecipes,.paprikarecipe,.zip,.json,.html,.htm"
              onChange={(event) => upload(event.target.files?.[0])}
            />
          </div>
        </div>

        {ready && (
          <section className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                {ready.titles.length} recipes ready
              </h2>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => void commitFile()}
              >
                {pending ? "Adding" : "Add to library"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Nothing is saved until you add them.
            </p>
            <ul className="divide-y rounded-xl bg-card text-sm ring-1 ring-foreground/10">
              {ready.titles.slice(0, 8).map((title, index) => (
                <li key={`${title}-${index}`} className="px-4 py-2.5">
                  {title}
                </li>
              ))}
              {ready.titles.length > 8 && (
                <li className="px-4 py-2.5 text-muted-foreground">
                  and {ready.titles.length - 8} more
                </li>
              )}
            </ul>
            {ready.skipped.length > 0 && (
              <details className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                <summary className="cursor-pointer font-medium">
                  Skipped {ready.skipped.length}
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {ready.skipped.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {result && (
          <section className="space-y-3" aria-live="polite">
            <h2 className="text-sm font-medium">
              {result.imported.length === 0
                ? "Nothing was imported"
                : `Imported ${result.imported.length} ${result.imported.length === 1 ? "recipe" : "recipes"}`}
            </h2>
            {result.imported.length > 0 && (
              <ul className="divide-y rounded-xl bg-card text-sm ring-1 ring-foreground/10">
                {result.imported.slice(0, 100).map((recipe) => (
                  <li key={recipe.id}>
                    <Link
                      to={`/recipes/${recipe.id}`}
                      className="block px-4 py-2.5 hover:bg-muted"
                      onClick={() => close(false)}
                    >
                      {recipe.title}
                    </Link>
                  </li>
                ))}
                {result.imported.length > 100 && (
                  <li className="px-4 py-2.5 text-muted-foreground">
                    and {result.imported.length - 100} more in your library
                  </li>
                )}
              </ul>
            )}
            {result.skipped.length > 0 && (
              <details className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                <summary className="cursor-pointer font-medium">
                  Skipped {result.skipped.length}
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {result.skipped.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportButton({
  onImported,
}: {
  onImported: (recipe: RecipeInput) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileUpIcon data-icon="inline-start" />
        Import
      </Button>
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        onImported={onImported}
      />
    </>
  );
}

export { ImportButton };
