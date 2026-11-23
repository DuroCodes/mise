import { UtensilsCrossedIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { compose, rawBase, repo } from "./build-info";
import { Command } from "./command";
import { mergeInto, weekList } from "./demo-data";
import { PantryDemo } from "./demos/pantry";
import { PlanDemo } from "./demos/plan";
import { CookDemo, RecipeDemo } from "./demos/recipe";
import { ShoppingDemo } from "./demos/shopping";

const nav = [
  { href: "#recipes", label: "Recipes" },
  { href: "#plan", label: "Plan" },
  { href: "#shopping", label: "Shopping" },
  { href: "#pantry", label: "Pantry" },
  { href: "#admin", label: "Admin" },
] as const;

const curlCompose = `mkdir mise
cd mise
curl -fsSL -o compose.yml ${rawBase}/main/compose.yml`;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t pt-14 sm:pt-20" aria-labelledby={`${id}-title`}>
      <h2
        id={`${id}-title`}
        className="max-w-[22ch] text-2xl font-medium tracking-tight text-balance sm:text-3xl"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function DemoFrame({
  children,
  caption,
  className,
}: {
  children: ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className="min-w-0">
      <div
        className={
          className ??
          "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
        }
      >
        {children}
      </div>
      {caption && (
        <figcaption className="mt-3 text-sm leading-6 text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Home() {
  const [list, setList] = useState(weekList);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring"
      >
        Skip to the page
      </a>

      <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <a
              href="#top"
              className="flex items-center gap-2 rounded-lg text-xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <UtensilsCrossedIcon className="size-5 text-brand" />
              Mise
            </a>
            <nav
              className="hidden items-center gap-4 text-sm text-muted-foreground md:flex"
              aria-label="On this page"
            >
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
              <a href={repo}>GitHub</a>
            </Button>
            <Button asChild size="sm">
              <a href="#install">Install</a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <section
            id="top"
            className="grid items-start gap-10 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pt-20"
          >
            <div className="lg:sticky lg:top-28">
              <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-5xl">
                The recipe box you host yourself.
              </h1>
              <p className="mt-5 max-w-[34rem] text-lg leading-8 text-muted-foreground">
                Mise keeps a household&apos;s recipes, meal plan, shopping list
                and pantry in one place. It runs in a single Docker container on
                a machine you own, and the code is open source.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="#install">Install with Docker</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={repo}>Source on GitHub</a>
                </Button>
              </div>
              <p className="mt-5 max-w-[34rem] text-sm leading-6 text-muted-foreground">
                Nothing to sign up for here. The first visit to your own copy
                creates the admin account.
              </p>
            </div>

            <DemoFrame
              caption="This is the app's recipe page, running in your browser. Change the servings, switch units, or start a timer from one of the steps."
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 max-sm:-mx-4 max-sm:rounded-none max-sm:ring-0"
            >
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
                <span className="text-muted-foreground max-sm:hidden">
                  Collections
                </span>
              </div>
              <div className="p-4 sm:p-6">
                <RecipeDemo />
              </div>
            </DemoFrame>
          </section>

          <Section id="recipes" title="Save a recipe from wherever you found it.">
            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div>
                <p className="max-w-[34rem] leading-7 text-muted-foreground">
                  Paste a link from a recipe site, TikTok or Instagram and Mise
                  pulls out the ingredients and steps. Moving from Paprika or
                  Mealie? Upload the export and the whole library comes with
                  you.
                </p>
                <p className="mt-4 max-w-[34rem] text-sm leading-6 text-muted-foreground">
                  Video imports read the caption and any text on screen. Add a
                  speech-to-text key for the ones where the recipe is only
                  spoken. On Android, you can share a link to Mise from any app.
                </p>
              </div>
              <DemoFrame caption="Cook mode shows one step at a time and keeps the screen awake. Use the buttons or the arrow keys.">
                <CookDemo />
              </DemoFrame>
            </div>
            <div className="mt-10 grid gap-6 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4">
              <Detail
                title="Scale and convert"
                body="Change the servings and every amount follows. Switch between metric and US units, oven temperatures included."
              />
              <Detail
                title="Timers in the steps"
                body="A duration such as “simmer 10 minutes” becomes a button. It counts down and chimes when the time is up."
              />
              <Detail
                title="Search and sort"
                body="Search titles, ingredients and steps. Filter by tag or favorites. Sort by quickest, top rated or recently cooked."
              />
              <Detail
                title="Collections"
                body="Private groups of recipes, such as Thanksgiving or weeknight dinners."
              />
              <Detail
                title="Ratings and a cooking log"
                body="Everyone rates recipes and logs when they cooked them, with notes."
              />
              <Detail
                title="Share links"
                body="A read-only link to one recipe, for someone without an account. Turn it off whenever you like."
              />
              <Detail
                title="Nutrition estimate"
                body="Per serving, worked out from a built-in food table. Nothing is sent anywhere."
              />
              <Detail
                title="Print layout"
                body="A clean page for the recipe you want on paper."
              />
            </div>
          </Section>

          <Section id="plan" title="Plan the week once.">
            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div>
                <p className="max-w-[34rem] leading-7 text-muted-foreground">
                  Drag recipes onto days, or tap Add on a phone. One button turns
                  the whole week into a shopping list.
                </p>
                <p className="mt-4 max-w-[34rem] text-sm leading-6 text-muted-foreground">
                  With notifications on, a note arrives at 6pm about tomorrow&apos;s
                  meals.
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
                <PlanDemo />
              </div>
            </div>
          </Section>

          <Section
            id="shopping"
            title="One list, in the order you walk the store."
          >
            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div>
                <p className="max-w-[34rem] leading-7 text-muted-foreground">
                  Add a recipe or a whole week. Matching ingredients are added
                  together, with units converted when they are compatible, so
                  three recipes that need olive oil give you one line.
                </p>
                <p className="mt-4 max-w-[34rem] leading-7 text-muted-foreground">
                  Save the stores you shop at with their sections in walking
                  order. Pick a store and the list sorts itself into that route.
                </p>
                <div className="mt-8 max-w-[34rem] space-y-5 border-t pt-6">
                  <Detail
                    title="Scan and shop"
                    body="Scan barcodes with the phone camera to check items off. Product names come from Open Food Facts."
                  />
                  <Detail
                    title="No signal needed"
                    body="The list works offline and syncs when you are back online."
                  />
                  <Detail
                    title="Done shopping"
                    body="Tell Mise how much of each item goes into the pantry, and it moves it there."
                  />
                </div>
              </div>
              <DemoFrame
                caption="The list for the week on the Plan card. Tick a few things off, or pick another store."
                className="mx-auto max-w-md overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
              >
                <ShoppingDemo items={list} />
              </DemoFrame>
            </div>
          </Section>

          <Section id="pantry" title="Cook from what you already have.">
            <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
              <div>
                <p className="max-w-[34rem] leading-7 text-muted-foreground">
                  Keep track of what is in the house, with use-by dates. “What
                  can I make” ranks your recipes by how much of each you already
                  have, and puts whatever is missing on the shopping list.
                </p>
                <p className="mt-4 max-w-[34rem] text-sm leading-6 text-muted-foreground">
                  A heads-up arrives at 9am when something needs using soon.
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
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
              </div>
            </div>
          </Section>

          <Section id="admin" title="It all stays on your machine.">
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Detail
                title="One folder"
                body="The database (SQLite) and uploaded images live in a single data folder. Mount it wherever you keep things you care about."
              />
              <Detail
                title="Backup and restore"
                body="Admins download a zip of everything: recipes, images, logs, plans, lists and a copy of the database. Restore it from the same page."
              />
              <Detail
                title="Accounts you control"
                body="The first visit creates the admin account. After that sign-up is closed, and admins add everyone else."
              />
              <Detail
                title="Installs like an app"
                body="Add it to a phone's home screen. Recipes you have opened stay readable offline."
              />
              <Detail
                title="Notifications"
                body="Timers that ring with the phone locked, plus the pantry and meal plan reminders. Off until you turn them on, per device."
              />
              <Detail
                title="AI is optional"
                body="Off unless you set an API key. It works with Anthropic, OpenAI, OpenRouter, or a local model through Ollama, and turns pasted text, a photo of a recipe card or a receipt into something Mise can use."
              />
            </div>
            <div className="mt-10 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[30rem] leading-7 text-muted-foreground">
                Four themes come with it, and this page is wearing one of them.
                Pick another from the palette in the header.
              </p>
              <ThemeToggle />
            </div>
          </Section>

          <section
            id="install"
            className="border-t pt-14 pb-16 sm:pt-20 sm:pb-24"
            aria-labelledby="install-title"
          >
            <h2
              id="install-title"
              className="text-3xl font-medium tracking-tight sm:text-4xl"
            >
              Install Mise
            </h2>
            <p className="mt-2 text-muted-foreground">
              About 2 minutes. Serves the whole household.
            </p>

            <div className="mt-8 grid gap-10 border-t pt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
              <div>
                <h3 className="font-medium">You need</h3>
                <ul className="mt-3 space-y-2.5 leading-7 text-muted-foreground">
                  {[
                    "A machine that stays on. A home server, a NAS or a Raspberry Pi will do.",
                    "Docker, with Compose.",
                    "An HTTPS address, if phones are going to install it or get notifications (optional).",
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-foreground/70"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <h3 className="font-medium">Steps</h3>
                <ol className="mt-3 space-y-6">
                  <li className="flex gap-3">
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      1
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="leading-7 text-muted-foreground">
                        Make a folder and fetch the compose file.
                      </p>
                      <Command code={curlCompose} />
                      <details className="text-sm text-muted-foreground">
                        <summary className="w-fit cursor-pointer rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring">
                          See what is in compose.yml
                        </summary>
                        <div className="mt-3">
                          <Command code={compose} />
                        </div>
                      </details>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      2
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="leading-7 text-muted-foreground">Start it.</p>
                      <Command code="docker compose up -d" />
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      3
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="max-w-[38rem] leading-7 text-muted-foreground">
                        Open{" "}
                        <code className="font-mono text-[0.9em] text-foreground">
                          localhost:3000
                        </code>{" "}
                        and create the admin account. Three example recipes are
                        waiting, including the shakshuka from the top of this
                        page.
                      </p>
                    </div>
                  </li>
                </ol>

                <p className="mt-8 max-w-[38rem] border-t pt-6 text-sm leading-6 text-muted-foreground">
                  Serving it from a domain? Set{" "}
                  <code className="font-mono text-[0.95em] text-foreground">
                    BETTER_AUTH_URL
                  </code>{" "}
                  to the public address in compose.yml. The{" "}
                  <a
                    className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    href={`${repo}#settings`}
                  >
                    settings reference
                  </a>{" "}
                  covers ports, the data folder, AI providers and the rest.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Mise is open source, and inspired by{" "}
            <a
              className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href="https://mealie.io"
            >
              Mealie
            </a>
            .
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Project">
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
              Report a problem
            </a>
            <a
              className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href={`${repo}/issues/new?template=theme-request.yml`}
            >
              Request a theme
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}

export { Home };
