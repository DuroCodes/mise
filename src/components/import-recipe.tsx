import { Link2Icon } from "lucide-react";
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
import { importRecipe } from "@/lib/api";
import { match } from "@/lib/result";
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
    const result = await importRecipe(link);
    match(
      result,
      (recipe) => {
        setUrl("");
        setPending(false);
        setOpen(false);
        onImported(recipe);
      },
      (message) => {
        setError(message);
        setPending(false);
      }
    );
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
            Paste a recipe link. Mise fills this form, and nothing is saved
            until you click Save.
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
