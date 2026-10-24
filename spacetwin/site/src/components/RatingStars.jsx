import React, { useState } from "react";
import { Star } from "lucide-react";

// Reusable star rating display.
// size: "sm" | "md" | "lg"  — controls icon size
// showNumber: boolean — show numeric value next to stars
// count: number — show "(count)" after rating
export default function RatingStars({ rating = 0, count = null, size = "sm", showNumber = false, className = "" }) {
  const sizes = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" };
  const cls = sizes[size] || sizes.sm;
  const rounded = Math.round(rating * 10) / 10;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${cls} ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted-foreground/20 text-muted-foreground/30"}`}
          />
        ))}
      </span>
      {showNumber && (
        <span className="font-semibold text-foreground">{rounded.toFixed(1)}</span>
      )}
      {count != null && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </span>
  );
}

// Interactive star picker for review submission
export function StarPicker({ value = 0, onChange, size = "lg" }) {
  const [hover, setHover] = useState(0);
  const sizes = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-9 w-9" };
  const cls = sizes[size] || sizes.lg;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="rounded-full p-1 transition"
          aria-label={`${n} stele`}
        >
          <Star
            className={`${cls} ${(hover || value) >= n ? "fill-amber-400 text-amber-400" : "fill-muted-foreground/15 text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

// Rating breakdown bars (5★ xx%, 4★ xx%, etc.)
export function RatingBreakdown({ distribution = {}, total = 0 }) {
  const rows = [5, 4, 3, 2, 1];
  return (
    <div className="space-y-1.5">
      {rows.map((star) => {
        const count = distribution[star] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="flex w-8 items-center gap-0.5 font-medium text-muted-foreground">
              {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right text-muted-foreground">{count}</span>
          </div>
        );
      })}
    </div>
  );
}