import { StarIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import type { RatingSummary } from "@/shared/recipe";

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            "size-3.5",
            value >= star - 0.25
              ? "fill-brand text-brand"
              : "text-muted-foreground/50"
          )}
        />
      ))}
    </span>
  );
}

function StarRating({
  rating,
  disabled,
  onRate,
}: {
  rating: RatingSummary;
  disabled?: boolean;
  onRate: (stars: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating.mine ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <div
        className="flex items-center"
        role="radiogroup"
        aria-label="Your rating"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating.mine === star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}${rating.mine === star ? ", tap to clear" : ""}`}
            disabled={disabled}
            className="rounded-md p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60"
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onRate(rating.mine === star ? null : star)}
          >
            <StarIcon
              className={cn(
                "size-5 transition-colors",
                shown >= star
                  ? "fill-brand text-brand"
                  : "text-muted-foreground/60"
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-muted-foreground">
        {rating.mine === null ? "Rate it" : "Your rating"}
        {rating.count > 0 && rating.average !== null && (
          <>
            {" · "}
            {rating.average.toFixed(1)} average from {rating.count}{" "}
            {rating.count === 1 ? "rating" : "ratings"}
          </>
        )}
      </span>
    </div>
  );
}

export { StarRating, Stars };
