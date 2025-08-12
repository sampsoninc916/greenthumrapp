// StarRating.tsx
import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function StarRating({ value, onChange, max = 5 }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1;
        const isActive = hovered !== null ? starValue <= hovered : starValue <= value;
        return (
          <button
            key={starValue}
            type="button"
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(starValue)}
            className="focus:outline-none"
            aria-label={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-7 w-7 transition-colors
                ${isActive ? "fill-yellow-400 text-yellow-400" : "fill-none text-black"}
                stroke-2`}
              style={{ stroke: isActive ? "#facc15" : "#000" }}
            />
          </button>
        );
      })}
    </div>
  );
}