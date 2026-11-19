import { useTheme } from "next-themes";
import { useEffect } from "react";

/** turn computed css colors (oklch, rgb, …) into #rrggbb for theme-color. */
const toHex = (cssColor: string) => {
  const probe = document.createElement("div");
  probe.style.backgroundColor = cssColor;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  const hex = [match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
};

const pageBackground = () => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  return (
    (raw ? toHex(raw) : null) ??
    toHex(getComputedStyle(document.body).backgroundColor)
  );
};

const setThemeColor = (color: string) => {
  document
    .querySelectorAll('meta[name="theme-color"][media]')
    .forEach((node) => node.remove());

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
};

/** keep the PWA / browser chrome in sync with the live page background. */
function ThemeChrome() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const sync = () => {
      const color = pageBackground();
      if (color) setThemeColor(color);
    };

    // next-themes flips the <html> class; wait a frame so --background is current.
    const frame = requestAnimationFrame(sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);

    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", sync);
    };
  }, [resolvedTheme]);

  return null;
}

export { ThemeChrome };
