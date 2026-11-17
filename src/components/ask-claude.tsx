import { SparklesIcon } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type SubmitEvent } from "react";
import Markdown, { type Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askClaude } from "@/lib/api";
import { easeOut } from "@/lib/motion";

const examples = [
  "What can I use instead of eggs?",
  "How do I make this dairy-free?",
  "I'm out of fresh garlic. What now?",
];

// Only simple text formatting is rendered; anything else (raw HTML, images,
// tables) is dropped or unwrapped to its text.
const allowed = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "code",
  "br",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
];

const heading: Components["h1"] = ({ children }) => (
  <p className="font-medium text-foreground">{children}</p>
);

const components: Components = {
  p: ({ children }) => <p className="leading-6">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-medium text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="space-y-2.5 pl-5 marker:text-brand list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-2.5 pl-5 marker:text-brand marker:font-medium list-decimal">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
      {children}
    </code>
  ),
  a: ({ children, href }) =>
    !href || !/^https?:\/\//i.test(href) ? (
      <span>{children}</span>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-4 hover:text-foreground"
      >
        {children}
      </a>
    ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand/40 pl-3">
      {children}
    </blockquote>
  ),
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
};

function AskClaude({ recipeId }: { recipeId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
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
    setAsked(trimmed);
    const result = await askClaude(recipeId, trimmed);
    setPending(false);
    if (result.ok) setAnswer(result.value.answer);
    else setError(result.error);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  const reset = () => {
    setAnswer(null);
    setAsked("");
    setQuestion("");
    setError(null);
    input.current?.focus();
  };

  return (
    <section className="min-w-0 space-y-3 print:hidden">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="size-4 text-brand" aria-hidden="true" />
        Substitutions
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={input}
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
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {(pending || answer) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: easeOut }}
          className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          aria-live="polite"
          aria-busy={pending}
        >
          <div className="flex items-center gap-2.5 border-b bg-muted/40 px-4 py-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15">
              <SparklesIcon
                className="size-3.5 text-brand"
                aria-hidden="true"
              />
            </span>
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">You asked </span>
              <span className="font-medium">{asked}</span>
            </p>
          </div>
          <div className="px-4 py-4 text-sm text-muted-foreground">
            {pending ? (
              <div className="space-y-2.5" aria-label="Asking Claude">
                {["w-11/12", "w-4/5", "w-2/3", "w-3/4"].map((width) => (
                  <div
                    key={width}
                    className={`h-3.5 animate-pulse rounded bg-muted ${width}`}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Markdown
                  allowedElements={allowed}
                  unwrapDisallowed
                  skipHtml
                  components={components}
                >
                  {answer ?? ""}
                </Markdown>
              </div>
            )}
          </div>
          {answer && !pending && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                Suggestions from Claude. Taste as you go.
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Ask another
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </section>
  );
}

export { AskClaude };
