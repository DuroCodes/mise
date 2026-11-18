import type * as React from "react";
import { cn } from "cn";

/** A soft gray block that stands in for content while it loads. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-lg bg-muted motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}

// Varied line widths so a column of placeholders reads like real text.
const widths = ["w-3/5", "w-2/5", "w-4/5", "w-1/2", "w-2/3", "w-1/3"];
const widthAt = (index: number) => widths[index % widths.length];

/** Placeholder recipe cards, shaped like RecipeCard, for card grids. */
function CardGridSkeleton({
  count = 6,
  label = "Loading recipes",
  media = "aspect-[4/3]",
}: {
  count?: number;
  label?: string;
  media?: string;
}) {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
        >
          <Skeleton className={cn("w-full rounded-none", media)} />
          <div className="space-y-2 p-4">
            <Skeleton className={cn("h-5", widthAt(index))} />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder rows inside a card, for lists like the pantry or stores. */
function ListSkeleton({
  rows = 5,
  label = "Loading",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className
      )}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className={cn("h-4", widthAt(index))} />
          <Skeleton className="ml-auto size-6 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Bare placeholder lines for small lists such as pickers and sidebars. */
function LinesSkeleton({
  rows = 6,
  label = "Loading",
  className,
  line = "h-8",
}: {
  rows?: number;
  label?: string;
  className?: string;
  line?: string;
}) {
  return (
    <div role="status" className={cn("space-y-1.5", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={line} />
      ))}
    </div>
  );
}

export { CardGridSkeleton, LinesSkeleton, ListSkeleton, Skeleton };
