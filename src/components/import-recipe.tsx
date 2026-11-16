import { Link2Icon, SparklesIcon } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aiRecipeFromUrl, importRecipe } from "@/lib/api";
import { match } from "@/lib/result";
import { useSession } from "@/lib/session-context";
import type { RecipeInput } from "@/shared/recipe";

function ImportRecipe({
  onImported,
}: {
  onImported: (recipe: RecipeInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { ai } = useSession();

  const finish = (recipe: RecipeInput) => {
    setUrl("");
    setPending(false);
    setFailedUrl(null);
    setOpen(false);
    onImported(recipe);
  };

  // Some sites refuse direct imports; Claude can often still read the page.
  const tryClaude = async () => {
    if (!failedUrl) return;
    setPending(true);
    setError(null);
    const result = await aiRecipeFromUrl(failedUrl);
    if (result.ok) finish(result.value);
    else {
      setError(result.error);
      setPending(false);
    }
  };

  const submit = async (event?: SubmitEvent<HTMLFormElement>) => {
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
    const result = await importRecipe(link);
    match(result, finish, (message) => {
      setError(message);
      setPending(false);
      if (/^https?:\/\//i.test(link)) setFailedUrl(link);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Link2Icon data-icon="inline-start" />
          Import from URL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Import from URL</DialogTitle>
          <DialogDescription>
            Paste a link. Nothing saves until you hit Save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="import-url">Recipe link</Label>
            <Input
              id="import-url"
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://"
              autoComplete="off"
              aria-invalid={Boolean(error)}
              onChange={(event) => setUrl(event.target.value)}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {error && failedUrl && ai && (
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void tryClaude()}>
                <SparklesIcon data-icon="inline-start" />
                {pending ? "Reading" : "Try with Claude"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button type="button" disabled={pending} onClick={() => submit()}>
              {pending ? "Importing" : "Fill the form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ImportRecipe };
