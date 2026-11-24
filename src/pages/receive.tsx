import { SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { aiRecipeFromUrl, importPage } from "@/lib/api";
import { readPageMessage, receivedKey } from "@/lib/bookmarklet";
import { useSession } from "@/lib/session-context";
import { useTitle } from "@/lib/use-title";
import type { RecipeInput } from "@/shared/recipe";

type State =
  | { kind: "waiting" }
  | { kind: "reading" }
  | { kind: "failed"; error: string; url: string | null }
  | { kind: "alone" };

function ReceivePage() {
  const navigate = useNavigate();
  const { ai } = useSession();
  const [state, setState] = useState<State>(() =>
    window.opener ? { kind: "waiting" } : { kind: "alone" }
  );
  useTitle("Send to Mise");

  const open = (recipe: RecipeInput) => {
    try {
      sessionStorage.setItem(receivedKey, JSON.stringify(recipe));
    } catch {
      setState({
        kind: "failed",
        error: "Couldn't hand the recipe to the editor",
        url: null,
      });
      return;
    }
    navigate("/recipes/new?received=1", { replace: true });
  };

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener) return;
    let done = false;
    const onMessage = async (event: MessageEvent) => {
      // only the tab that opened this one, and only a well-formed page.
      if (done || event.source !== opener) return;
      const page = readPageMessage(event.data);
      if (!page) return;
      done = true;
      setState({ kind: "reading" });
      const result = await importPage(page.url, page.html);
      if (result.ok) open(result.value);
      else setState({ kind: "failed", error: result.error, url: page.url });
    };
    window.addEventListener("message", onMessage);
    // tell the bookmark we're ready (repeated in case it's still setting up).
    const ping = () => {
      try {
        opener.postMessage("mise-ready", "*");
      } catch {}
    };
    ping();
    const timer = window.setInterval(ping, 500);
    const giveUp = window.setTimeout(() => {
      window.clearInterval(timer);
      if (!done)
        setState({
          kind: "failed",
          error: "Nothing arrived. Click the button on the recipe page again.",
          url: null,
        });
    }, 20_000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
      window.clearTimeout(giveUp);
    };
    // runs once for this tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryAi = async (url: string) => {
    setState({ kind: "reading" });
    const result = await aiRecipeFromUrl(url);
    if (result.ok) open(result.value);
    else setState({ kind: "failed", error: result.error, url: null });
  };

  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <h1 className="text-2xl font-medium tracking-tight">Send to Mise</h1>
      {state.kind === "waiting" && (
        <p className="text-sm text-muted-foreground">
          Waiting for the recipe page…
        </p>
      )}
      {state.kind === "reading" && (
        <p className="text-sm text-muted-foreground">Reading the recipe…</p>
      )}
      {state.kind === "alone" && (
        <p className="text-sm text-muted-foreground">
          Open a recipe page and click the Send to Mise button.{" "}
          <Link to="/settings" className="underline underline-offset-4">
            Get the button
          </Link>
        </p>
      )}
      {state.kind === "failed" && (
        <div className="space-y-3">
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
          <div className="flex justify-center gap-2">
            {ai && state.url && (
              <Button
                type="button"
                onClick={() => state.url && void tryAi(state.url)}
              >
                <SparklesIcon data-icon="inline-start" />
                Try with AI
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/recipes/new">New recipe</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { ReceivePage };
