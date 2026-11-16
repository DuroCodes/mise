import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreBackup, type RestoreSummary } from "@/lib/api";

function BackupPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [summary, setSummary] = useState<RestoreSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    if (!file) return;
    setPending(true);
    setError(null);
    const result = await restoreBackup(file);
    setPending(false);
    setFile(null);
    if (input.current) input.current.value = "";
    if (result.ok) setSummary(result.value);
    else setError(result.error);
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium tracking-tight">Backups</h2>
      <div className="space-y-4 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        <p className="leading-6 text-muted-foreground">
          A backup is a zip with every recipe, image, rating, cooking-log entry,
          collection, meal plan, shopping list, store, and pantry, plus a full
          copy of the database. The database copy includes accounts and password hashes,
          so keep the file somewhere private.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/admin/backup" download>
              <DownloadIcon data-icon="inline-start" />
              Download backup
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {pending ? "Restoring" : "Restore from backup"}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".zip,.json"
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              setFile(chosen);
              setSummary(null);
              setError(null);
            }}
          />
        </div>
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {summary && (
          <p className="leading-6" aria-live="polite">
            Restored {summary.recipes} recipes, {summary.images} images,{" "}
            {summary.ratings} ratings, {summary.cookLogs} log entries,{" "}
            {summary.collections} collections, {summary.mealPlan} planned meals,
            {summary.shopping} shopping items, {summary.stores} stores, and{" "}
            {summary.pantry} pantry items.
            {summary.skipped > 0 &&
              ` Skipped ${summary.skipped} rows for people without an account here.`}
          </p>
        )}
      </div>

      <Dialog open={file !== null} onOpenChange={(open) => !open && !pending && setFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore {file?.name}?</DialogTitle>
            <DialogDescription>
              Recipes in the backup replace recipes with the same id here;
              everything else is added. People are matched by email, and
              accounts themselves are not changed. To roll the whole site back,
              including accounts, follow the steps in the README instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setFile(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={restore}>
              {pending ? "Restoring" : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export { BackupPanel };
