import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { cn } from "cn";
import { tabIndex } from "@/lib/tabs";

type Direction = "forward" | "back" | "none";

/** ids collapse to "*", so /recipes/a → /recipes/b keeps the page mounted. */
const routeKey = (path: string) =>
  path
    .split("/")
    .map((part, index) => (index === 2 && part && part !== "new" ? "*" : part))
    .join("/");

const depth = (path: string) => path.split("/").filter(Boolean).length;

const directionFor = (from: string, to: string) => {
  const fromTab = tabIndex(from);
  const toTab = tabIndex(to);
  if (fromTab !== -1 && toTab !== -1)
    return toTab > fromTab ? "forward" : "back";
  if (depth(to) > depth(from)) return "forward";
  if (depth(to) < depth(from)) return "back";
  return "none";
};

function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const key = routeKey(pathname);
  const [page, setPage] = useState({
    key,
    path: pathname,
    direction: "none" as Direction,
  });

  if (page.key !== key) {
    setPage({
      key,
      path: pathname,
      direction: directionFor(page.path, pathname),
    });
  } else if (page.path !== pathname) {
    setPage({ ...page, path: pathname });
  }

  return (
    <div
      key={key}
      className={cn(
        "animate-in duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] fade-in motion-reduce:animate-none",
        page.direction === "forward" && "slide-in-from-right-6",
        page.direction === "back" && "slide-in-from-left-6",
        page.direction === "none" && "slide-in-from-bottom-2"
      )}
    >
      {children}
    </div>
  );
}

export { PageTransition };
