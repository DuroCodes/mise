import { Link, Navigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useTitle } from "@/lib/use-title";
import { sharedLink } from "@/lib/view";

/** Where Android's share sheet lands: hand the link to the recipe importer. */
function ShareTargetPage() {
  const [params] = useSearchParams();
  useTitle("Import · Mise");
  const link = sharedLink(params);
  if (link)
    return (
      <Navigate
        to={`/recipes/new?import=${encodeURIComponent(link)}`}
        replace
      />
    );
  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <h1 className="text-2xl font-medium tracking-tight">No link found</h1>
      <p className="text-sm text-muted-foreground">
        Share a recipe page's link to import it.
      </p>
      <Button asChild variant="outline">
        <Link to="/recipes/new">New recipe</Link>
      </Button>
    </div>
  );
}

export { ShareTargetPage };
