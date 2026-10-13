// apps/web/components/icons.tsx
// Inline SVG icons: a handful of paths is far cheaper than an icon package
// against the first-load budget (CLAUDE.md 7).

type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const SearchIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const CloseIcon = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const SunIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

export const TrainIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="5" y="3" width="14" height="14" rx="3" />
    <path d="M5 11h14M9 21l-2-4M15 21l2-4" />
    <circle cx="9" cy="14" r=".6" fill="currentColor" />
    <circle cx="15" cy="14" r=".6" fill="currentColor" />
  </svg>
);

export const PinIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const LinkIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

export const FlagIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const ChevronIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
