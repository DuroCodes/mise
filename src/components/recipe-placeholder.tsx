import { Skeleton } from "@/components/ui/skeleton";

function RecipePlaceholder() {
  return (
    <div className="w-full space-y-8" aria-busy="true">
      <span className="sr-only">Loading recipe</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}

export { RecipePlaceholder };
