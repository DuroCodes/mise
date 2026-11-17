import { BellIcon, BookmarkIcon, DownloadIcon, KeyRoundIcon, Share2Icon, SquarePlusIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  canPromptInstall,
  installed,
  isIos,
  onInstallChange,
  promptInstall,
} from "@/lib/install";
import {
  disablePush,
  enablePush,
  loadPushPrefs,
  needsInstallForPush,
  pushSupported,
  sendTestPush,
  updatePushPrefs,
  type PushPrefs,
} from "@/lib/push";
import { bookmarkletFor } from "@/lib/bookmarklet";
import { useTitle } from "@/lib/use-title";

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="flex items-center gap-2 text-base font-medium">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60"
    >
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted ring-1 ring-foreground/15"
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-1 size-4 rounded-full bg-background shadow transition-all",
            checked ? "left-5" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function InstallSection() {
  const [, setVersion] = useState(0);
  useEffect(() => onInstallChange(() => setVersion((value) => value + 1)), []);

  return (
    <Section icon={<DownloadIcon className="size-4 text-brand" aria-hidden="true" />} title="Install the app">
      {installed() ? (
        <p className="text-sm text-muted-foreground">Installed. Open Mise from your home screen.</p>
      ) : canPromptInstall() ? (
        <Button type="button" onClick={() => void promptInstall()}>
          <DownloadIcon data-icon="inline-start" />
          Install Mise
        </Button>
      ) : isIos() ? (
        <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          In Safari, tap <Share2Icon className="size-4" aria-label="Share" /> then
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <SquarePlusIcon className="size-4" aria-hidden="true" /> Add to Home Screen
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Use your browser's menu and pick Install or Add to Home Screen.
        </p>
      )}
    </Section>
  );
}

function SendToMiseSection() {
  const link = useRef<HTMLAnchorElement>(null);
  // React blocks javascript: links in JSX, so the bookmark's address is set directly.
  useEffect(() => {
    link.current?.setAttribute("href", bookmarkletFor(window.location.origin));
  }, []);

  return (
    <Section icon={<BookmarkIcon className="size-4 text-brand" aria-hidden="true" />} title="Send to Mise button">
      <p className="text-sm text-muted-foreground">
        Drag this to your bookmarks bar. On any recipe page, click it to bring the recipe here. Works on
        sites that block imports.
      </p>
      <a
        ref={link}
        onClick={(event) => {
          event.preventDefault();
          toast("Drag the button to your bookmarks bar instead.");
        }}
        className="inline-flex h-9 cursor-grab items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
      >
        <BookmarkIcon className="size-4" aria-hidden="true" />
        Send to Mise
      </a>
    </Section>
  );
}

function NotificationsSection() {
  const supported = pushSupported();
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    loadPushPrefs().then((value) => {
      if (!active) return;
      setPrefs(value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [supported]);

  const turnOn = async () => {
    setBusy(true);
    const next = { useSoon: true, tomorrow: true };
    const error = await enablePush(next);
    setBusy(false);
    if (error) toast.error(error);
    else {
      setPrefs(next);
      toast.success("Notifications on");
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setPrefs(null);
  };

  const change = async (patch: Partial<PushPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!(await updatePushPrefs(patch))) {
      setPrefs(prefs);
      toast.error("Couldn't save that");
    }
  };

  return (
    <Section icon={<BellIcon className="size-4 text-brand" aria-hidden="true" />} title="Notifications">
      {!supported ? (
        <p className="text-sm text-muted-foreground">
          {needsInstallForPush()
            ? "On iPhone, install Mise to your home screen first."
            : "This browser can't show notifications."}
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : prefs ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">On for this device. Timers always ring.</p>
          <Toggle
            label="Use soon"
            hint="9am, when pantry items are about to expire"
            checked={prefs.useSoon}
            onChange={(useSoon) => void change({ useSoon })}
          />
          <Toggle
            label="Tomorrow's meals"
            hint="6pm, with a thaw reminder"
            checked={prefs.tomorrow}
            onChange={(tomorrow) => void change({ tomorrow })}
          />
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const error = await sendTestPush();
                if (error) toast.error(error);
              }}
            >
              Send a test
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void turnOff()}>
              Turn off
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Timers when your phone is locked, food about to expire, and tomorrow's meals.
          </p>
          <Button type="button" disabled={busy} onClick={() => void turnOn()}>
            <BellIcon data-icon="inline-start" />
            {busy ? "Turning on" : "Turn on"}
          </Button>
        </div>
      )}
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (next.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Couldn't change your password");
      return;
    }
    setCurrent("");
    setNext("");
    toast.success("Password changed. Other devices were signed out.");
  };

  return (
    <Section icon={<KeyRoundIcon className="size-4 text-brand" aria-hidden="true" />} title="Password">
      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={pending || !current || !next}>
          {pending ? "Saving" : "Change password"}
        </Button>
      </form>
    </Section>
  );
}

function SettingsPage() {
  useTitle("Settings · Mise");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
      <InstallSection />
      <SendToMiseSection />
      <NotificationsSection />
      <PasswordSection />
    </div>
  );
}

export { SettingsPage };
