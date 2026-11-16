import { LogOutIcon, PlusIcon, UtensilsCrossedIcon } from "lucide-react";
import { NavLink } from "react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "cn";

function AppHeader({ account }: { account: Account }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <NavLink
            to="/"
            end
            className="flex items-center gap-2 rounded-lg text-xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <UtensilsCrossedIcon className="size-5 text-brand" />
            Mise
          </NavLink>
          <nav className="flex items-center gap-3 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )
              }
            >
              Recipes
            </NavLink>
            {account.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
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
            size="sm"
            onClick={() => authClient.signOut()}
          >
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}

export { AppHeader };
