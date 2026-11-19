import { UtensilsCrossedIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTitle } from "@/lib/use-title";

const quips = [
  "That page is not here.",
  "Mise'd it.",
  "Nothing on the board.",
  "The cupboard is bare.",
  "Someone ate this page.",
];

function NotFoundPage() {
  useTitle("Not found · Mise");
  const [taps, setTaps] = useState(0);
  const quip = quips[Math.min(taps, quips.length - 1)] ?? quips[0];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <button
            type="button"
            className="rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
            aria-label="Not found"
            onClick={() => setTaps((n) => Math.min(n + 1, quips.length - 1))}
          >
            <h1 className="text-2xl font-medium tracking-tight">{quip}</h1>
          </button>
          <p className="text-sm text-muted-foreground">
            The recipe may have been deleted, or the link is wrong.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link to="/">Back to recipes</Link>
          </Button>
          {taps >= quips.length - 1 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UtensilsCrossedIcon className="size-3.5 text-brand" />
              Still hungry? Try the library.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { NotFoundPage };
