import { themeIds, themeOptions } from "@/lib/themes";

type Choice = (typeof themeOptions)[number]["id"];

const storageKey = "mise-site-theme";
const prefersDark = matchMedia("(prefers-color-scheme: dark)");

const isChoice = (value: string | undefined): value is Choice =>
  themeOptions.some((option) => option.id === value);

const stored = (): Choice => {
  try {
    const value = localStorage.getItem(storageKey) ?? undefined;
    if (isChoice(value)) return value;
  } catch {
    // storage can be unavailable in private windows.
  }
  return "system";
};

const resolved = (choice: Choice) =>
  choice === "system" ? (prefersDark.matches ? "dark" : "light") : choice;

const apply = (choice: Choice) => {
  const theme = resolved(choice);
  const root = document.documentElement;
  root.classList.remove(...themeIds);
  root.classList.add(theme);
  root.dataset.theme = choice;

  for (const button of document.querySelectorAll<HTMLElement>(
    "[data-theme-choice]"
  ))
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === choice)
    );

  // the browser's own chrome follows the page, as it does in the app.
  const background = themeOptions.find((option) => option.id === theme)
    ?.swatch[0];
  if (background)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", background);
};

/** wires every theme button on the page; the choice is kept for next time. */
export const startThemes = () => {
  apply(stored());

  document.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-theme-choice]")
        : null;
    const choice = button?.dataset.themeChoice;
    if (!isChoice(choice)) return;
    try {
      localStorage.setItem(storageKey, choice);
    } catch {
      // the choice still applies to this visit.
    }
    apply(choice);
  });

  prefersDark.addEventListener("change", () => {
    if (stored() === "system") apply("system");
  });
};
