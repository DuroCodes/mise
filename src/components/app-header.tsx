import {
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UtensilsCrossedIcon,
  WifiOffIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { clearOfflineData } from "@/lib/offline";
import { disablePush } from "@/lib/push";
import { tabs as links } from "@/lib/tabs";
import { cn } from "cn";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
  );

const slide = { type: "spring", stiffness: 520, damping: 40 } as const;

const signOut = async () => {
  await disablePush();
  await clearOfflineData();
  await authClient.signOut();
};

/** underline that only slides sideways inside the sticky header. */
function HeaderNav({ admin }: { admin: boolean }) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false });

  const measure = () => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) {
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

  useLayoutEffect(() => {
    measure();
  }, [pathname, admin]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [admin]);

  return (
    <nav
      ref={navRef}
      className="relative flex items-center gap-4 text-sm"
      aria-label="Main"
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={(state) => cn(navClass(state), "max-sm:hidden")}
        >
          {link.label}
        </NavLink>
      ))}
      {admin && (
        <NavLink to="/admin" className={navClass}>
          Admin
        </NavLink>
      )}
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

function AppHeader({
  account,
  offline,
}: {
  account: Account;
  offline: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background pt-[env(safe-area-inset-top)] print:hidden">
      {offline && (
        <p className="flex items-center justify-center gap-1.5 bg-muted px-4 py-1 text-xs text-muted-foreground">
          <WifiOffIcon className="size-3.5" aria-hidden="true" />
          Offline. Saved recipes still work.
        </p>
      )}
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 rounded-lg text-xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <UtensilsCrossedIcon className="size-5 text-brand" />
            Mise
          </NavLink>
          <HeaderNav admin={account.role === "admin"} />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-[cubic-bezier(0.16,1,0.3,1)] hover:[&_svg]:rotate-60 aria-[current=page]:[&_svg]:rotate-60 motion-reduce:[&_svg]:transition-none"
          >
            <NavLink to="/settings">
              <SettingsIcon />
            </NavLink>
          </Button>
          <Button
            asChild
            size="icon-sm"
            className="sm:hidden"
            aria-label="New recipe"
          >
            <NavLink to="/recipes/new">
              <PlusIcon />
            </NavLink>
          </Button>
          <Button asChild size="sm" className="max-sm:hidden">
            <NavLink to="/recipes/new">
              <PlusIcon data-icon="inline-start" />
              New recipe
            </NavLink>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="sm:hidden"
            aria-label="Sign out"
            onClick={() => void signOut()}
          >
            <LogOutIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:hidden"
            onClick={() => void signOut()}
          >
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

/** tab bar for phones; the header carries these links on wider screens. */
function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))] sm:hidden print:hidden"
    >
      <ul className="grid grid-cols-5">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              aria-label={link.label}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-11 items-center justify-center transition-colors outline-none focus-visible:bg-muted",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-tab"
                      transition={slide}
                      className="absolute inset-x-3 inset-y-1.5 rounded-full bg-muted"
                    />
                  )}
                  <link.icon
                    className="relative size-5 transition-transform duration-150 ease-out group-active:scale-90 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { AppHeader, BottomNav };
