import { SparklesIcon } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askClaude } from "@/lib/api";

const examples = [
  "What can I use instead of eggs?",
  "How do I make this dairy-free?",
  "I'm out of fresh garlic. What now?",
];

function AskClaude({ recipeId }: { recipeId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Ask a question first");
      return;
    }
    setPending(true);
    setError(null);
    setAnswer(null);
    const result = await askClaude(recipeId, trimmed);
    setPending(false);
    if (result.ok) setAnswer(result.value.answer);
    else setError(result.error);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <section className="min-w-0 space-y-3 print:hidden">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="size-4 text-brand" aria-hidden="true" />
        Substitutions
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={question}
          maxLength={500}
          placeholder="Ask about swaps, allergies, or missing ingredients"
          aria-label="Question about this recipe"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Thinking" : "Ask Claude"}
        </Button>
      </form>
      {!answer && !pending && !error && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setQuestion(example);
                void ask(example);
              }}
            >
              {example}
            </Button>
          ))}
        </div>
      )}
      {pending && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Asking Claude…
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {answer && (
        <div
          className="rounded-xl bg-card p-4 text-sm leading-6 whitespace-pre-line ring-1 ring-foreground/10"
          aria-live="polite"
        >
          {answer}
        </div>
      )}
    </section>
  );
}

export { AskClaude };
