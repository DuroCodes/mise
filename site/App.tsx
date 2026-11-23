import { ThemeProvider } from "next-themes";
import { MemoryRouter } from "react-router";
import { ThemeChrome } from "@/components/theme-chrome";
import { themeIds } from "@/lib/themes";
import { DemoTimers } from "./demos/timers";
import { Home } from "./home";

function App() {
  return (
    <ThemeProvider
      attribute="class"
      themes={[...themeIds]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="mise-site-theme"
    >
      <ThemeChrome />
      <MemoryRouter>
        <DemoTimers>
          <Home />
        </DemoTimers>
      </MemoryRouter>
    </ThemeProvider>
  );
}

export default App;
