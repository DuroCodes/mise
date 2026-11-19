import {
  CalendarDaysIcon,
  BookOpenIcon,
  FolderIcon,
  LogOutIcon,
  PackageOpenIcon,
  PlusIcon,
  SettingsIcon,
  ShoppingBasketIcon,
  UtensilsCrossedIcon,
  WifiOffIcon,
} from "lucide-react";
import { NavLink } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { clearOfflineData } from "@/lib/offline";
import { disablePush } from "@/lib/push";
import { cn } from "cn";

const links = [
  { to: "/", label: "Recipes", icon: BookOpenIcon, end: true },
  { to: "/plan", label: "Plan", icon: CalendarDaysIcon, end: false },
  { to: "/shopping", label: "Shopping", icon: ShoppingBasketIcon, end: false },
  { to: "/pantry", label: "Pantry", icon: PackageOpenIcon, end: false },
  { to: "/collections", label: "Collections", icon: FolderIcon, end: false },
] as const;

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
  );

const signOut = async () => {
  await disablePush();
  await clearOfflineData();
  await authClient.signOut();
};

function AppHeader({
  account,
  offline,
}: {
  account: Account;
  offline: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
      {offline && (
        <p className="flex items-center justify-center gap-1.5 bg-muted px-4 py-1 text-xs text-muted-foreground">
          <WifiOffIcon className="size-3.5" aria-hidden="true" />
          Offline. Saved recipes still work.
        </p>
      )}
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 rounded-lg text-xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <UtensilsCrossedIcon className="size-5 text-brand" />
            Mise
          </NavLink>
          <nav className="flex items-center gap-4 text-sm" aria-label="Main">
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
            {account.role === "admin" && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
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
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background sm:hidden print:hidden"
    >
      <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              aria-label={link.label}
              className={({ isActive }) =>
                cn(
                  "flex h-12 items-center justify-center outline-none focus-visible:bg-muted",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )
              }
            >
              <link.icon className="size-5" aria-hidden="true" />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { AppHeader, BottomNav };
