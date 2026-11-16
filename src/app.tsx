import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ThemeProvider } from "next-themes";
import { AppHeader } from "@/components/app-header";
import { RecipePlaceholder } from "@/components/recipe-placeholder";
import { Toaster } from "@/components/ui/sonner";
import { currentAccount, type Account } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { EditorPage } from "@/pages/editor";
import { LibraryPage } from "@/pages/library";
import { NotFoundPage } from "@/pages/not-found";
import { AdminPage } from "@/pages/admin";
import { RecipePage } from "@/pages/recipe";
import { LoginPage, SetupPage } from "@/pages/session";

function SignedInApp() {
  const session = authClient.useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session.data) return;
    let active = true;
    currentAccount().then((result) => {
      if (!active) return;
      if (result.ok) setAccount(result.value);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [session.data]);

  if (session.isPending) return <RecipePlaceholder />;
  if (!session.data || failed) return <Navigate to="/login" replace />;
  if (!account) return <RecipePlaceholder />;

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring"
      >
        Skip to content
      </a>
      <AppHeader account={account} />
      <main
        id="content"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/admin" element={<AdminPage selfId={account.id} />} />
          <Route path="/people" element={<Navigate to="/admin" replace />} />
          <Route path="/recipes/new" element={<EditorPage />} />
          <Route path="/recipes/:id" element={<RecipePage />} />
          <Route path="/recipes/:id/edit" element={<EditorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="mise-theme"
    >
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<SignedInApp />} />
          </Routes>
          <Toaster position="bottom-right" />
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
