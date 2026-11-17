import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { ThemeProvider } from "next-themes";
import { AppHeader, BottomNav } from "@/components/app-header";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { TimerProvider } from "@/components/timer-provider";
import { Toaster } from "@/components/ui/sonner";
import { currentAccount, getFeatures, type Account } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { SessionContext } from "@/lib/session-context";
import { themeIds } from "@/lib/themes";
import { AdminPage } from "@/pages/admin";
import { CollectionPage, CollectionsPage } from "@/pages/collections";
import { CookPage } from "@/pages/cook";
import { EditorPage } from "@/pages/editor";
import { LibraryPage } from "@/pages/library";
import { NotFoundPage } from "@/pages/not-found";
import { PantryPage } from "@/pages/pantry";
import { PlanPage } from "@/pages/plan";
import { ReceivePage } from "@/pages/receive";
import { RecipePage } from "@/pages/recipe";
import { InvitePage, LoginPage, SetupPage } from "@/pages/session";
import { SettingsPage } from "@/pages/settings";
import { ShareTargetPage } from "@/pages/share-target";
import { SharedPage } from "@/pages/shared";
import { ShoppingPage } from "@/pages/shopping";
import { StoresPage } from "@/pages/stores";

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
};

const fullScreen = /^\/recipes\/(?:new|[^/]+\/(?:edit|cook))\/?$/;

function SignedInApp() {
  const session = authClient.useSession();
  const online = useOnline();
  const location = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [ai, setAi] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [featuresVersion, setFeaturesVersion] = useState(0);
  const [failed, setFailed] = useState(false);

  // Offline, the session check fails; the service worker can still answer
  // /api/me from its cache, so the saved recipes stay readable.
  const tryOffline =
    !session.isPending && !session.data && (Boolean(session.error) || !online);
  const signedIn = Boolean(session.data) || tryOffline;

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    currentAccount().then((result) => {
      if (!active) return;
      if (result.ok) setAccount(result.value);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    getFeatures().then((result) => {
      if (!active || !result.ok) return;
      setAi(result.value.ai);
      setAiAvailable(result.value.aiAvailable ?? result.value.ai);
    });
    return () => {
      active = false;
    };
  }, [signedIn, featuresVersion]);

  if (session.isPending) return <RecipePlaceholder />;
  if (!signedIn || failed) {
    const back = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={back === "/" ? "/login" : `/login?next=${encodeURIComponent(back)}`}
        replace
      />
    );
  }
  if (!account) return <RecipePlaceholder />;

  const hideTabs = fullScreen.test(location.pathname);

  return (
    <SessionContext.Provider
      value={{
        account,
        ai,
        aiAvailable,
        refreshFeatures: () => setFeaturesVersion((value) => value + 1),
        offline: !online,
      }}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring"
      >
        Skip to content
      </a>
      <AppHeader account={account} offline={!online} />
      <main
        id="content"
        className={
          hideTabs
            ? "isolate mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
            : "isolate mx-auto w-full max-w-6xl px-4 pt-8 pb-28 sm:px-6 sm:py-10 print:pb-0"
        }
      >
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/admin" element={<AdminPage selfId={account.id} />} />
          <Route path="/people" element={<Navigate to="/admin" replace />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/stores" element={<StoresPage />} />
          <Route path="/pantry" element={<PantryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/share-target" element={<ShareTargetPage />} />
          <Route path="/receive" element={<ReceivePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionPage />} />
          <Route path="/import" element={<Navigate to="/" replace />} />
          <Route path="/recipes/new" element={<EditorPage />} />
          <Route path="/recipes/:id" element={<RecipePage />} />
          <Route path="/recipes/:id/edit" element={<EditorPage />} />
          <Route path="/recipes/:id/cook" element={<CookPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!hideTabs && <BottomNav />}
    </SessionContext.Provider>
  );
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      themes={[...themeIds]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="mise-theme"
    >
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <TimerProvider>
            <Routes>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/s/:token" element={<SharedPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/*" element={<SignedInApp />} />
            </Routes>
          </TimerProvider>
          <Toaster position="bottom-right" mobileOffset={{ bottom: 88 }} />
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
