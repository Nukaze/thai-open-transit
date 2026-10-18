// apps/web/components/Flag.tsx
"use client";

import { useId, type ReactNode } from "react";
import type { FlagId } from "../lib/i18n";

// Inline SVG, not emoji: Windows draws flag emoji as bare letters ("TH").
// Drawn here rather than copied from a flag set, so nothing third-party
// ships. Decorative only - the language's native name always sits beside it.
export function Flag({ id, width = 21 }: { id: FlagId; width?: number }) {
  // Per instance: the same flag can be on screen twice (the picker's current
  // row and its list), and clip ids must be unique in the document.
  const uid = useId();
  return (
    <svg
      className="flag"
      width={width}
      height={(width * 2) / 3}
      viewBox="0 0 30 20"
      aria-hidden="true"
    >
      <clipPath id={`${uid}-shape`}>
        <rect width="30" height="20" rx="3" />
      </clipPath>
      <g clipPath={`url(#${uid}-shape)`}>{drawFlag(id, uid)}</g>
      <rect
        width="30"
        height="20"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
      />
    </svg>
  );
}

function drawFlag(id: FlagId, uid: string): ReactNode {
  switch (id) {
    // Thai tricolour: red, white, blue (double), white, red.
    case "th":
      return (
        <>
          <rect width="30" height="20" fill="#A51931" />
          <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
          <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
        </>
      );
    case "jp":
      return (
        <>
          <rect width="30" height="20" fill="#FFFFFF" />
          <circle cx="15" cy="10" r="6" fill="#BC002D" />
        </>
      );
    // Five yellow stars on red; the four small ones point at the large one.
    case "cn":
      return (
        <>
          <rect width="30" height="20" fill="#EE1C25" />
          <path
            fill="#FFDE00"
            d="M5.00 2.00L5.67 4.07L7.85 4.07L6.09 5.35L6.76 7.43L5.00 6.15L3.24 7.43L3.91 5.35L2.15 4.07L4.33 4.07Z M9.14 2.51L9.62 1.97L9.25 1.34L9.91 1.63L10.39 1.08L10.33 1.80L11.00 2.09L10.29 2.25L10.22 2.97L9.85 2.35Z M11.01 4.14L11.66 3.82L11.56 3.10L12.07 3.62L12.72 3.30L12.38 3.95L12.88 4.47L12.17 4.34L11.83 4.99L11.73 4.27Z M11.04 6.73L11.76 6.70L11.96 6.00L12.21 6.68L12.94 6.66L12.37 7.10L12.62 7.79L12.01 7.38L11.44 7.83L11.64 7.13Z M9.22 8.38L9.90 8.63L10.35 8.06L10.32 8.79L11.00 9.05L10.30 9.24L10.26 9.96L9.87 9.36L9.16 9.55L9.62 8.98Z"
          />
        </>
      );
    // English: the US flag top-left and the Union Jack bottom-right, split
    // on the diagonal. Each is a full flag cropped (`slice`) to the 3:2
    // box; the Union Jack is clipped to the lower-right triangle.
    case "us-gb":
      return (
        <>
          <clipPath id={`${uid}-diagonal`}>
            <path d="M0 20 30 0v20Z" />
          </clipPath>
          <svg
            width="30"
            height="20"
            viewBox="0 0 190 100"
            preserveAspectRatio="xMinYMin slice"
          >
            <rect width="190" height="100" fill="#B22234" />
            {[1, 3, 5, 7, 9, 11].map((i) => (
              <rect
                key={i}
                y={i * 7.69}
                width="190"
                height="7.69"
                fill="#FFFFFF"
              />
            ))}
            <rect width="76" height="53.85" fill="#3C3B6E" />
          </svg>
          <g clipPath={`url(#${uid}-diagonal)`}>
            <svg
              width="30"
              height="20"
              viewBox="0 0 60 30"
              preserveAspectRatio="xMidYMid slice"
            >
              <rect width="60" height="30" fill="#012169" />
              <path d="M0 0 60 30M60 0 0 30" stroke="#FFFFFF" strokeWidth="6" />
              <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="2" />
              <path d="M30 0v30M0 15h60" stroke="#FFFFFF" strokeWidth="10" />
              <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
            </svg>
          </g>
        </>
      );
  }
}
