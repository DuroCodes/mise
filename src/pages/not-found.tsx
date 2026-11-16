import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTitle } from "@/lib/use-title";

function NotFoundPage() {
  useTitle("Not found · Mise");

  return (
    <div className="mx-auto max-w-lg space-y-4 py-16">
      <h1 className="text-2xl font-medium tracking-tight">
        That page is not here
      </h1>
      <p className="text-sm text-muted-foreground">
        The recipe may have been deleted.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Back to recipes</Link>
      </Button>
    </div>
  );
}

export { NotFoundPage };
