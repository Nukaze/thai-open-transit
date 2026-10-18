// apps/web/components/Flag.tsx
"use client";

import { useId, type ReactNode } from "react";
import type { FlagId } from "../lib/i18n";

// Inline SVG, not emoji: Windows draws flag emoji as bare letters ("TH").
// Decorative only - the language's native name always sits beside it.
export function Flag({ id, width = 21 }: { id: FlagId; width?: number }) {
  const clip = useId();
  return (
    <svg
      className="flag"
      width={width}
      height={(width * 2) / 3}
      viewBox="0 0 30 20"
      aria-hidden="true"
    >
      <clipPath id={clip}>
        <rect width="30" height="20" rx="3" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>{FLAGS[id]}</g>
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

const FLAGS: Record<FlagId, ReactNode> = {
  // Thai tricolour: red, white, blue (double), white, red.
  th: (
    <>
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
    </>
  ),
  jp: (
    <>
      <rect width="30" height="20" fill="#FFFFFF" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
  // English: the US flag's canton half and the Union Jack's centre half,
  // each cropped from its own full flag (`slice`) so both stay readable at
  // 20px.
  "us-gb": (
    <>
      <svg
        width="15"
        height="20"
        viewBox="0 0 190 100"
        preserveAspectRatio="xMinYMid slice"
      >
        <rect width="190" height="100" fill="#B22234" />
        {[1, 3, 5, 7, 9, 11].map((i) => (
          <rect key={i} y={i * 7.69} width="190" height="7.69" fill="#FFFFFF" />
        ))}
        <rect width="76" height="53.85" fill="#3C3B6E" />
      </svg>
      <svg
        x="15"
        width="15"
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
    </>
  ),
};
