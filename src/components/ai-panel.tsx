import { SparklesIcon } from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { InlineError } from "@/components/inline-error";
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
  local: {
    keys: "https://ollama.com/library",
    site: "ollama.com",
    model: "hermes3",
    modelHint:
      "The name your model server uses, like hermes3 or qwen3. It has to be pulled already. Photos need a model that reads images.",
  },
};

const localDefaultUrl = "http://localhost:11434/v1";

function AiPanel() {
  const { refreshFeatures } = useSession();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const apply = (next: AiStatus) => {
    setStatus(next);
    refreshFeatures();
    if (next.provider) setProvider(next.provider);
    setModel(next.source === "saved" ? (next.model ?? "") : "");
    setBaseURL(next.source === "saved" ? (next.baseURL ?? "") : "");
  };

  useEffect(() => {
    let active = true;
    getAiStatus().then((result) => {
      if (!active) return;
      if (result.ok) {
        setStatus(result.value);
        if (result.value.provider) setProvider(result.value.provider);
        if (result.value.source === "saved") {
          setModel(result.value.model ?? "");
          setBaseURL(result.value.baseURL ?? "");
        }
      } else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const local = provider === "local";
  const keepsKey =
    status?.source === "saved" &&
    status.provider === provider &&
    status.hint !== null;

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!local && !key.trim() && !keepsKey) {
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
      baseURL: local ? baseURL.trim() : "",
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
        <p className="text-sm text-muted-foreground">
          Reads recipes, answers questions, and plans meals. What you send goes
          to the provider.
        </p>
      </div>

      <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm" aria-live="polite">
          {status === null
            ? "Checking…"
            : status.enabled && status.provider
              ? `On: ${aiProviderLabel[status.provider]}, ${status.model}${
                  status.baseURL ? ` at ${status.baseURL}` : ""
                }${status.hint ? `, key ending ${status.hint}` : ""}${
                  fromEnvironment ? ", from the server's environment" : ""
                }.`
              : "Off. Pick a provider to turn it on."}
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
                    const same =
                      status.source === "saved" && status.provider === value;
                    setModel(same ? (status.model ?? "") : "");
                    setBaseURL(same ? (status.baseURL ?? "") : "");
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
            {local && (
              <div className="space-y-2">
                <Label htmlFor="ai-url">Server address</Label>
                <Input
                  id="ai-url"
                  value={baseURL}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="url"
                  placeholder={localDefaultUrl}
                  disabled={pending}
                  onChange={(event) => setBaseURL(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Any OpenAI-compatible server (Ollama, LM Studio, llama.cpp,
                  vLLM). Leave blank for Ollama on this machine. Nothing leaves
                  your network.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ai-key">
                {local
                  ? "API key (optional)"
                  : keepsKey
                    ? "API key (blank keeps the saved one)"
                    : "API key"}
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
                {local ? (
                  <>
                    Only if your server asks for one. Find models at{" "}
                    <a
                      href={help.keys}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {help.site}
                    </a>
                    . Saving sends a one-word test request, which can take a
                    minute while the model loads.
                  </>
                ) : (
                  <>
                    Get one at{" "}
                    <a
                      href={help.keys}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {help.site}
                    </a>
                    . Saving sends a one-word test request, then keeps the key
                    in this server's data folder. It's never put in backups or
                    shown again.
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
                  <SparklesIcon data-icon="inline-start" />
                  Turn off
                </Button>
              )}
              <InlineError message={error} />
            </div>
          </form>
        )}

        {fromEnvironment && (
          <p className="text-sm text-muted-foreground">
            Set with MISE_AI_MODEL and MISE_AI_API_KEY. Remove them to change it
            here.
          </p>
        )}
      </div>
    </section>
  );
}

export { AiPanel };
