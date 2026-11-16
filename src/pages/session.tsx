import { UtensilsCrossedIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode, type SubmitEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite, describeInvite, setupNeeded } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { easeOut } from "@/lib/motion";
import { clearOfflineData } from "@/lib/offline";
import { useTitle } from "@/lib/use-title";
import { safeNext } from "@/lib/view";

function AccountShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-10"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOut }}
    >
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-medium tracking-tight"
        >
          <UtensilsCrossedIcon className="size-5 text-brand" />
          Mise
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{lede}</p>
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}

function useSetupGate(expectNeeded: boolean) {
  const [ready, setReady] = useState<"wait" | "setup" | "app">("wait");
  useEffect(() => {
    let active = true;
    setupNeeded().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setReady(expectNeeded ? "setup" : "app");
        return;
      }
      setReady(result.value.needed ? "setup" : "app");
    });
    return () => {
      active = false;
    };
  }, [expectNeeded]);
  return ready;
}

function SetupPage() {
  const navigate = useNavigate();
  const gate = useSetupGate(true);
  const session = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useTitle("Set up Mise");

  if (session.data) return <Navigate to="/" replace />;
  if (gate === "app") return <Navigate to="/login" replace />;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.signUp.email({ name, email, password });
    if (result.error) {
      setError(result.error.message ?? "Could not create the account");
      setPending(false);
      return;
    }
    navigate("/");
  };

  return (
    <AccountShell
      title="Create the first account"
      lede="This account is the admin. You can add other people after you sign in."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || gate === "wait"}>
          {pending ? "Creating" : "Create account"}
        </Button>
      </form>
    </AccountShell>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const gate = useSetupGate(false);
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  useTitle("Sign in · Mise");

  if (session.data) return <Navigate to={next} replace />;
  if (gate === "setup") return <Navigate to="/setup" replace />;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    await clearOfflineData();
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Could not sign in");
      setPending(false);
      return;
    }
    navigate(next, { replace: true });
  };

  return (
    <AccountShell title="Sign in" lede="Recipes stay on this machine.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || gate === "wait"}>
          {pending ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </AccountShell>
  );
}

function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [invite, setInvite] = useState<
    "loading" | "invalid" | { inviterName: string | null }
  >("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useTitle("Join Mise");

  useEffect(() => {
    let active = true;
    describeInvite(token).then((result) => {
      if (!active) return;
      setInvite(result.ok ? { inviterName: result.value.inviterName } : "invalid");
    });
    return () => {
      active = false;
    };
  }, [token]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Add your name and email");
      return;
    }
    if (password.length < 8) {
      setError("Use a password of at least 8 characters");
      return;
    }
    setPending(true);
    setError(null);
    const created = await acceptInvite(token, {
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (!created.ok) {
      setError(created.error);
      setPending(false);
      return;
    }
    await clearOfflineData();
    const signedIn = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (signedIn.error) {
      navigate("/login", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  };

  if (invite === "loading" || session.isPending)
    return (
      <AccountShell title="Join Mise" lede="Checking your invite…">
        <span />
      </AccountShell>
    );

  if (invite === "invalid")
    return (
      <AccountShell
        title="This invite doesn't work"
        lede="It expired or was already used. Ask for a new one."
      >
        <Button asChild variant="outline">
          <Link to="/login">Sign in instead</Link>
        </Button>
      </AccountShell>
    );

  if (session.data)
    return (
      <AccountShell
        title="You're already signed in"
        lede={`Signed in as ${session.data.user.email}. Sign out to use this invite.`}
      >
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/">Go to recipes</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await clearOfflineData();
              await authClient.signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </AccountShell>
    );

  return (
    <AccountShell
      title="Join Mise"
      lede={
        invite.inviterName
          ? `${invite.inviterName} invited you.`
          : "You're invited."
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating your account" : "Create account"}
        </Button>
      </form>
    </AccountShell>
  );
}

export { InvitePage, LoginPage, SetupPage };
