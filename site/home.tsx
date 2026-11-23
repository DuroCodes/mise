import {
  ArchiveIcon,
  BellIcon,
  ContainerIcon,
  FolderIcon,
  KeyRoundIcon,
  Link2Icon,
  ScanBarcodeIcon,
  SparklesIcon,
  StarIcon,
  TimerIcon,
  UtensilsCrossedIcon,
  WifiOffIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnderlineNav } from "@/components/underline-nav";
import { tabs } from "@/lib/tabs";
import { cn } from "cn";
import { compose, rawBase, repo } from "./build-info";
import { Command } from "./command";
import { mergeInto, weekList } from "./demo-data";
import { PantryDemo } from "./demos/pantry";
import { PlanDemo } from "./demos/plan";
import { CookDemo, RecipeDemo } from "./demos/recipe";
import { ShoppingDemo } from "./demos/shopping";

/** lucide dropped brand icons; keep the mark as a tiny inline svg. */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const nav = [
  { href: "#recipes", label: "Recipes" },
  { href: "#plan", label: "Plan" },
  { href: "#shopping", label: "Shopping" },
  { href: "#pantry", label: "Pantry" },
  { href: "#install", label: "Install" },
] as const;

const curlCompose = `mkdir mise
cd mise
curl -fsSL -o compose.yml ${rawBase}/main/compose.yml`;

const extras: { label: string; blurb: string; icon: LucideIcon }[] = [
  {
    label: "Timers",
    blurb: "Tap a time in a step. It keeps going in the background.",
    icon: TimerIcon,
  },
  {
    label: "Scan & shop",
    blurb: "Point at a barcode while you walk the aisles.",
    icon: ScanBarcodeIcon,
  },
  {
    label: "Collections",
    blurb: "Group recipes however you like: weeknights, baking, guests.",
    icon: FolderIcon,
  },
  {
    label: "Ratings",
    blurb: "Score recipes after you cook them.",
    icon: StarIcon,
  },
  {
    label: "Share links",
    blurb: "Send a recipe to someone without an account.",
    icon: Link2Icon,
  },
  {
    label: "Works offline",
    blurb: "Cook and check things off without a signal.",
    icon: WifiOffIcon,
  },
  {
    label: "Notifications",
    blurb: "Get a nudge when a timer finishes.",
    icon: BellIcon,
  },
  {
    label: "Backups",
    blurb: "Export everything. Bring it back later.",
    icon: ArchiveIcon,
  },
  {
    label: "Optional AI",
    blurb: "Import messy links and plan meals, if you want it.",
    icon: SparklesIcon,
  },
  {
    label: "You own the data",
    blurb: "One container on a machine you control.",
    icon: KeyRoundIcon,
  },
];

const features = [
  {
    id: "recipes",
    title: "Recipes",
    blurb: "Import from a link, TikTok, Instagram, or an export.",
    icon: tabs[0].icon,
    demo: "recipe" as const,
  },
  {
    id: "cook",
    title: "Cook mode",
    blurb: "One step at a time. Tap a time to start a timer.",
    icon: TimerIcon,
    demo: "cook" as const,
  },
  {
    id: "plan",
    title: "Plan",
    blurb: "Plan the week, then send it to shopping.",
    icon: tabs[1].icon,
    demo: "plan" as const,
  },
  {
    id: "shopping",
    title: "Shopping",
    blurb: "One list, ordered by aisle.",
    icon: tabs[2].icon,
    demo: "shopping" as const,
  },
  {
    id: "pantry",
    title: "Pantry",
    blurb: "See what you can cook with what's on hand.",
    icon: tabs[3].icon,
    demo: "pantry" as const,
  },
] as const;

const sectionIds = [
  ...features.map((feature) => feature.id),
  "install",
] as const;

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0] ?? "recipes");

  useEffect(() => {
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

function DemoShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

function Home() {
  const [list, setList] = useState(weekList);
  const active = useActiveSection(sectionIds);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring"
      >
        Skip to the page
      </a>

      <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <a
              href="#top"
              className="flex items-center gap-2 rounded-lg text-xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <UtensilsCrossedIcon className="size-5 text-brand" />
              Mise
            </a>
            <UnderlineNav
              aria-label="On this page"
              className="hidden text-muted-foreground md:flex"
            >
              {nav.map((item) => {
                const id = item.href.slice(1);
                const current =
                  id === "install"
                    ? active === "install"
                    : active === id ||
                      (id === "recipes" &&
                        (active === "recipes" || active === "cook"));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    data-active={current ? "true" : undefined}
                    className={cn(
                      "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring",
                      current ? "text-foreground" : "hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </a>
                );
              })}
            </UnderlineNav>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon" aria-label="GitHub">
              <a href={repo} target="_blank" rel="noreferrer">
                <GithubIcon />
              </a>
            </Button>
            <Button asChild size="sm">
              <a href="#install">
                <ContainerIcon data-icon="inline-start" />
                Install
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <div className="mx-auto w-full max-w-5xl space-y-14 px-4 pt-10 pb-16 sm:space-y-16 sm:px-6 sm:pt-12 sm:pb-20">
          <section
            id="top"
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10"
          >
            <div className="lg:sticky lg:top-24">
              <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-5xl">
                The recipe box you host yourself.
              </h1>
              <p className="mt-3 max-w-[32rem] text-lg leading-7 text-muted-foreground">
                Recipes, a meal plan, shopping list, and pantry in one Docker
                container on a machine you own.
              </p>
              <div className="mt-6">
                <Button asChild size="lg">
                  <a href="#install">
                    <ContainerIcon data-icon="inline-start" />
                    Install with Docker
                  </a>
                </Button>
              </div>
            </div>

            <DemoShell>
              <div
                className="flex h-11 items-center gap-4 border-b px-4 text-sm sm:px-5"
                aria-hidden="true"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <UtensilsCrossedIcon className="size-4 text-brand" />
                  Mise
                </span>
                <span className="relative text-foreground">
                  Recipes
                  <span className="absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full bg-brand" />
                </span>
                <span className="text-muted-foreground">Plan</span>
                <span className="text-muted-foreground">Shopping</span>
                <span className="text-muted-foreground max-sm:hidden">
                  Pantry
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <RecipeDemo />
              </div>
            </DemoShell>
          </section>

          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <section
                key={feature.id}
                id={feature.id}
                className="space-y-5 border-t pt-10 sm:pt-12"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                    {feature.title}
                  </p>
                  <h2 className="mt-1 max-w-[36ch] text-2xl font-medium tracking-tight text-balance sm:text-3xl">
                    {feature.blurb}
                  </h2>
                </div>
                <DemoShell>
                  {feature.demo === "recipe" && (
                    <div className="p-4 sm:p-5">
                      <RecipeDemo />
                    </div>
                  )}
                  {feature.demo === "cook" && <CookDemo />}
                  {feature.demo === "plan" && (
                    <div className="p-3 sm:p-4">
                      <PlanDemo />
                    </div>
                  )}
                  {feature.demo === "shopping" && <ShoppingDemo items={list} />}
                  {feature.demo === "pantry" && (
                    <PantryDemo
                      onAdd={(recipe, missing) =>
                        setList((current) =>
                          mergeInto(
                            current,
                            recipe.ingredients.filter((item) =>
                              missing.includes(item.name)
                            ),
                            recipe.title
                          )
                        )
                      }
                    />
                  )}
                </DemoShell>
              </section>
            );
          })}

          <section className="border-t pt-10 sm:pt-12">
            <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
              And more
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {extras.map(({ label, blurb, icon: Icon }) => (
                <li
                  key={label}
                  className="rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10"
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 shrink-0 text-brand" aria-hidden />
                    {label}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {blurb}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="install"
            className="border-t pt-10 sm:pt-12"
            aria-labelledby="install-title"
          >
            <h2
              id="install-title"
              className="text-2xl font-medium tracking-tight sm:text-3xl"
            >
              Install
            </h2>
            <p className="mt-1 text-muted-foreground">
              One compose file on a machine you own.
            </p>
            <ol className="mt-6 max-w-2xl space-y-4">
              <li className="space-y-2">
                <p className="text-sm font-medium">1. Get the compose file</p>
                <Command code={curlCompose} />
                <details className="text-sm text-muted-foreground">
                  <summary className="w-fit cursor-pointer rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring">
                    compose.yml
                  </summary>
                  <div className="mt-2">
                    <Command code={compose} />
                  </div>
                </details>
              </li>
              <li className="space-y-2">
                <p className="text-sm font-medium">2. Start it</p>
                <Command code="docker compose up -d" />
              </li>
              <li>
                <p className="text-sm font-medium">3. Open localhost:3000</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the admin account. That&apos;s it.
                </p>
              </li>
            </ol>
            <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
              On a domain, set{" "}
              <code className="font-mono text-foreground">BETTER_AUTH_URL</code>{" "}
              in compose.yml.{" "}
              <a
                className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                href={`${repo}#settings`}
              >
                Settings reference
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p className="min-w-0 truncate">
            Open source, inspired by{" "}
            <a
              className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href="https://mealie.io"
            >
              Mealie
            </a>
            .
          </p>
          <nav
            className="flex shrink-0 gap-x-4 sm:gap-x-5"
            aria-label="Project"
          >
            <a
              className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href={repo}
            >
              Source
            </a>
            <a
              className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href={`${repo}/issues`}
            >
              Issues
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}

export { Home };
