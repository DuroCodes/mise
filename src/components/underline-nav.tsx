import { motion } from "motion/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "cn";

const slide = { type: "spring", stiffness: 520, damping: 40 } as const;

/**
 * slides an underline under the active child. mark the current item with
 * aria-current="page" or data-active="true".
 */
function UnderlineNav({
  className,
  children,
  ...props
}: {
  children: ReactNode;
} & ComponentPropsWithoutRef<"nav">) {
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const active =
        nav.querySelector<HTMLElement>('[aria-current="page"]') ??
        nav.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        setBar((current) =>
          current.ready ? { ...current, ready: false, width: 0 } : current
        );
        return;
      }
      setBar({
        left: active.offsetLeft,
        width: active.offsetWidth,
        ready: true,
      });
    };

    measure();

    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    resize?.observe(nav);

    const mutate = new MutationObserver(measure);
    mutate.observe(nav, {
      attributes: true,
      attributeFilter: ["aria-current", "data-active"],
      subtree: true,
      childList: true,
    });

    return () => {
      resize?.disconnect();
      mutate.disconnect();
    };
  }, []);

  return (
    <nav
      {...props}
      ref={navRef}
      className={cn("relative flex items-center gap-4 text-sm", className)}
    >
      {children}
      {bar.ready && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 h-0.5 rounded-full bg-brand"
          initial={false}
          animate={{ left: bar.left, width: bar.width }}
          transition={slide}
        />
      )}
    </nav>
  );
}

export { UnderlineNav };
