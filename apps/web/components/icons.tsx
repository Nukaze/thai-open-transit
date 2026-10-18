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

// The favicon's mark (app/favicon.ico) redrawn as a vector: an S-curve line
// between two station dots, the same primitive Map.tsx draws stations with.
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

// Location arrow; `filled` marks the map as following the user.
export const LocateIcon = ({
  size = 20,
  filled = false,
}: P & { filled?: boolean }) => (
  <svg {...base(size)}>
    <path
      d="M20 4 4 11.2l7 1.8 1.8 7L20 4Z"
      fill={filled ? "currentColor" : "none"}
    />
  </svg>
);

// Same arrow, struck through: location is unavailable or was denied.
export const LocateOffIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M20 4 4 11.2l7 1.8 1.8 7L20 4Z" />
    <path d="M3 3l18 18" />
  </svg>
);

export const PlusIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M5 12h14" />
  </svg>
);

export const InfoIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.75" r=".6" fill="currentColor" />
  </svg>
);

// A ground plane in perspective with an arrow: up tilts it further back,
// down lays it flatter.
export const TiltIcon = ({
  size = 20,
  direction,
}: P & { direction: "up" | "down" }) => (
  <svg {...base(size)}>
    <path d="M8 13h8l3.5 7h-15L8 13Z" />
    <path
      d={direction === "up" ? "M12 9V3M9 6l3-3 3 3" : "M12 3v6M9 6l3 3 3-3"}
    />
  </svg>
);

// Map "home" (back to the first-load camera): a house, the convention from
// GIS home buttons. A circular arrow there reads as reload.
export const HomeIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-5.5h4V20" />
  </svg>
);

export const ResetViewIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
    <path d="M3.5 3.5v5h5" />
  </svg>
);

export const SlidersIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

// Visibility actions: the open eye labels "Show", the struck-through eye
// "Hide" (the action, as on a password field's reveal button).
export const EyeIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ size = 14 }: P) => (
  <svg {...base(size)}>
    <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);

export const CheckIcon = ({ size = 18 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const GlobeIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);
