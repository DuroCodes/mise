import { RecipePlaceholder } from "@/components/recipe-placeholder";
import {
  CardGridSkeleton,
  ListSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * the whole app in gray, shown while the session loads. It matches the real
 * header and page width so nothing jumps when the app appears, and guesses
 * the page's shape from the address.
 */
function AppSkeleton({ path }: { path: string }) {
  const recipe = /^\/recipes\/(?!new)[^/]+\/?$/.test(path);
  const cards = path === "/" || path.startsWith("/collections");

  return (
    <div aria-busy="true">
      <div className="sticky top-0 z-40 border-b bg-background/80 print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Skeleton className="h-6 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-8 w-20 md:block" />
            <Skeleton className="hidden h-8 w-20 md:block" />
            <Skeleton className="hidden h-8 w-20 md:block" />
            <Skeleton className="size-8" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-28 sm:px-6 sm:py-10">
        {recipe ? (
          <RecipePlaceholder />
        ) : (
          <div className="space-y-8">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            {cards ? (
              <CardGridSkeleton label="Loading" />
            ) : (
              <ListSkeleton label="Loading" />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export { AppSkeleton };
