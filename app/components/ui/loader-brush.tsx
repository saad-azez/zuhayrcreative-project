"use client";

// Animated BRUSH loader — a paintbrush sweeps around the centre and paints a
// ring in currentColor. Reuses only the shared motion keyframes from
// app/globals.css: `pencil__stroke` (the ring being drawn) and `pencil__rotate`
// (the orbit). The tool itself is a real brush glyph — splayed red bristles, a
// silver ferrule, and a tapered maroon handle pointing in toward the centre —
// so it reads as a brush, not a pencil.

interface BrushLoaderProps {
  className?: string;
}

export const Component = ({ className }: BrushLoaderProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="200px"
      width="200px"
      viewBox="0 0 200 200"
      className={`pencil${className ? ` ${className}` : ""}`}
    >
      {/* The ring the brush paints — currentColor from the parent. */}
      <circle
        transform="rotate(-113,100,100)"
        strokeLinecap="round"
        strokeDashoffset="439.82"
        strokeDasharray="439.82 439.82"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        r="70"
        className="pencil__stroke"
      />

      {/* Orbiting brush. Its origin is the centre (100,100); the glyph points
          outward along -y, bristle tip at the ring (r≈72), handle toward the
          centre. */}
      <g transform="translate(100,100)" className="pencil__rotate">
        {/* Handle — tapered, rounded butt near the centre. */}
        <path
          d="M-8 -47 L 8 -47 L 6 -18 Q 0 -10 -6 -18 Z"
          fill="hsl(345, 68%, 22%)"
        />
        <path
          d="M-8 -47 L -3 -47 L -4 -18 Q -5 -14 -6 -18 Z"
          fill="hsl(345, 58%, 34%)"
          opacity="0.55"
        />

        {/* Ferrule — metal band. */}
        <rect x="-10" y="-56" width="20" height="9" rx="2.5" fill="hsl(220, 8%, 78%)" />
        <rect x="-10" y="-56" width="20" height="3" rx="1.5" fill="hsl(220, 10%, 92%)" />
        <rect x="-10" y="-49.5" width="20" height="1.5" fill="hsl(220, 8%, 55%)" opacity="0.6" />

        {/* Bristles — splayed red tuft, narrowing to the painting tip at the
            ring, with a white "loaded paint" tip and split-bristle streaks. */}
        <path
          d="M0 -72 C -7 -64 -10 -60 -9 -56 L 9 -56 C 10 -60 7 -64 0 -72 Z"
          fill="hsl(352, 88%, 52%)"
        />
        <path
          d="M0 -72 C -4 -65 -5 -60 -4 -56 L 4 -56 C 5 -60 4 -65 0 -72 Z"
          fill="hsl(352, 90%, 72%)"
          opacity="0.6"
        />
        <path
          d="M0 -72 C -2.5 -67 -2.5 -63 -2 -60 L 2 -60 C 2.5 -63 2.5 -67 0 -72 Z"
          fill="#ffffff"
          opacity="0.9"
        />
        <path
          d="M-6 -57 L -3 -70 M0 -56 L 0 -71 M6 -57 L 3 -70"
          stroke="hsl(352, 85%, 38%)"
          strokeWidth="0.9"
          fill="none"
          opacity="0.5"
        />
      </g>
    </svg>
  );
};
