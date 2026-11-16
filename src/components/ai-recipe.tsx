import { ImageIcon, SparklesIcon, XIcon } from "lucide-react";
import { useRef, useState, type SubmitEvent } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aiRecipe } from "@/lib/api";
import type { RecipeInput } from "@/shared/recipe";

const accepted = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Turns pasted text or a photo of a recipe card into a filled-in form. */
function AiRecipe({ onImported }: { onImported: (recipe: RecipeInput) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!accepted.includes(file.type)) {
      setError("Use a JPEG, PNG, GIF, or WebP photo");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photos must be under 5MB");
      return;
    }
    setError(null);
    setImage(file);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!text.trim() && !image) {
      setError("Paste a recipe or add a photo");
      return;
    }
    setPending(true);
    setError(null);
    const result = await aiRecipe(text, image);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText("");
    setImage(null);
    setOpen(false);
    onImported(result.value);
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
          <SparklesIcon data-icon="inline-start" />
          Text or photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>Read a recipe with Claude</DialogTitle>
          <DialogDescription>
            Paste recipe text, or add a photo of a cookbook page or a recipe
            card. Claude fills this form, and nothing is saved until you click
            Save. The text and photo are sent to Anthropic to do this.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="ai-text">Recipe text</Label>
            <Textarea
              id="ai-text"
              value={text}
              rows={7}
              maxLength={60000}
              className="max-h-[40svh] overflow-y-auto"
              placeholder="Paste the ingredients and steps"
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImageIcon data-icon="inline-start" />
              {image ? "Change photo" : "Add a photo"}
            </Button>
            {image && (
              <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                <span className="truncate">{image.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove photo"
                  onClick={() => setImage(null)}
                >
                  <XIcon />
                </Button>
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={accepted.join(",")}
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Reading" : "Fill the form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AiRecipe };
