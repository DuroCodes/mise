import { FileUpIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { importFile, type ImportResult } from "@/lib/api";
import { useTitle } from "@/lib/use-title";

const sources = [
  ["Paprika", ".paprikarecipes export"],
  ["Mealie", "Export or backup (.zip / .json)"],
  ["Anything else", "Recipe .json (JSON-LD) or saved .html page"],
] as const;

function ImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useTitle("Import · Mise");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setPending(file.name);
    setError(null);
    setResult(null);
    const response = await importFile(file);
    setPending(null);
    if (input.current) input.current.value = "";
    if (response.ok) setResult(response.value);
    else setError(response.error);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">Import recipes</h1>
        <p className="text-sm text-muted-foreground">
          From another app. For a single website,{" "}
          <Link to="/recipes/new" className="underline underline-offset-4">
            import from URL
          </Link>
          .
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {sources.map(([name, help]) => (
          <li key={name} className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
            <p className="font-medium">{name}</p>
            <p className="mt-1 leading-5 text-muted-foreground">{help}</p>
          </li>
        ))}
      </ul>

      <div
        className={
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors " +
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
        <FileUpIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {pending ? `Importing ${pending}…` : "Drop a file here, or"}
        </p>
        <Button type="button" disabled={pending !== null} onClick={() => input.current?.click()}>
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

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-3" aria-live="polite">
          <h2 className="text-base font-medium">
            {result.imported.length === 0
              ? "Nothing was imported"
              : `Imported ${result.imported.length} ${result.imported.length === 1 ? "recipe" : "recipes"}`}
          </h2>
          {result.imported.length > 0 && (
            <ul className="divide-y rounded-xl bg-card text-sm ring-1 ring-foreground/10">
              {result.imported.slice(0, 100).map((recipe) => (
                <li key={recipe.id}>
                  <Link to={`/recipes/${recipe.id}`} className="block px-4 py-2.5 hover:bg-muted">
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
    </div>
  );
}

export { ImportPage };
