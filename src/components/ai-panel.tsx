import { SparklesIcon } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aiProviderLabel,
  aiProviders,
  getAiStatus,
  removeAiKey,
  saveAiSetup,
  type AiProvider,
  type AiStatus,
} from "@/lib/api";
import { useSession } from "@/lib/session-context";

const providerHelp: Record<
  AiProvider,
  { keys: string; site: string; model: string; modelHint: string }
> = {
  anthropic: {
    keys: "https://platform.claude.com/settings/keys",
    site: "platform.claude.com",
    model: "claude-opus-5-5",
    modelHint: "Leave blank for claude-opus-5-5.",
  },
  openai: {
    keys: "https://platform.openai.com/api-keys",
    site: "platform.openai.com",
    model: "gpt-5",
    modelHint: "Use a model that reads images, for recipe and pantry photos.",
  },
  openrouter: {
    keys: "https://openrouter.ai/settings/keys",
    site: "openrouter.ai",
    model: "anthropic/claude-opus-5-5",
    modelHint: "Use the full OpenRouter name, like vendor/model.",
  },
};

function AiPanel() {
  const { setAi } = useSession();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const apply = (next: AiStatus) => {
    setStatus(next);
    setAi(next.enabled);
    if (next.provider) setProvider(next.provider);
    setModel(next.source === "saved" ? (next.model ?? "") : "");
  };

  useEffect(() => {
    let active = true;
    getAiStatus().then((result) => {
      if (!active) return;
      if (result.ok) {
        setStatus(result.value);
        if (result.value.provider) setProvider(result.value.provider);
        if (result.value.source === "saved") setModel(result.value.model ?? "");
      } else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const keepsKey = status?.source === "saved" && status.provider === provider;

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!key.trim() && !keepsKey) {
      setError("Paste the API key");
      return;
    }
    if (provider !== "anthropic" && !model.trim()) {
      setError("Name the model to use");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveAiSetup({
      provider,
      model: model.trim(),
      apiKey: key.trim(),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setKey("");
    apply(result.value);
    toast.success("AI is on");
  };

  const remove = async () => {
    setPending(true);
    setError(null);
    const result = await removeAiKey();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setKey("");
    apply(result.value);
    toast.success("AI is off");
  };

  const fromEnvironment = status?.source === "environment";
  const help = providerHelp[provider];

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight">
          <SparklesIcon className="size-5 text-brand" aria-hidden="true" />
          AI
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Turns on reading recipes from photos and pasted text, substitution
          answers, pantry photos, recipe search and meal planning. When someone
          uses one, the recipe or pantry involved is sent to the provider.
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm" aria-live="polite">
          {status === null
            ? "Checking…"
            : status.enabled && status.provider
              ? `On: ${aiProviderLabel[status.provider]}, ${status.model}, key ending ${status.hint}${
                  fromEnvironment ? ", from the server's environment" : ""
                }.`
              : "Off. Add a key to turn it on."}
        </p>

        {status && !fromEnvironment && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => {
                    setProvider(value as AiProvider);
                    setModel(
                      status.source === "saved" && status.provider === value
                        ? (status.model ?? "")
                        : ""
                    );
                    setError(null);
                  }}
                  disabled={pending}
                >
                  <SelectTrigger id="ai-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aiProviders.map((id) => (
                      <SelectItem key={id} value={id}>
                        {aiProviderLabel[id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model">Model</Label>
                <Input
                  id="ai-model"
                  value={model}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={help.model}
                  disabled={pending}
                  onChange={(event) => setModel(event.target.value)}
                />
              </div>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              {help.modelHint}
            </p>
            <div className="space-y-2">
              <Label htmlFor="ai-key">
                {keepsKey ? "API key (blank keeps the saved one)" : "API key"}
              </Label>
              <Input
                id="ai-key"
                type="password"
                value={key}
                autoComplete="off"
                spellCheck={false}
                placeholder={keepsKey ? `Saved key ${status.hint}` : ""}
                disabled={pending}
                onChange={(event) => setKey(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get one at{" "}
                <a
                  href={help.keys}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {help.site}
                </a>
                . Saving sends a one-word test request, then keeps the key in
                this server's data folder. It's never put in backups or shown
                again.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? "Checking" : "Save"}
              </Button>
              {status.enabled && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={remove}
                >
                  Turn off
                </Button>
              )}
            </div>
          </form>
        )}

        {fromEnvironment && (
          <p className="text-xs text-muted-foreground">
            Set by ANTHROPIC_API_KEY or MISE_AI_API_KEY and MISE_AI_MODEL. To
            manage it here instead, start the server without them.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export { AiPanel };
