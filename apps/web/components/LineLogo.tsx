// apps/web/components/LineLogo.tsx

import type { Line } from "schema";
import { lineLogoUrl } from "../lib/lineLogos";

// The line's own logo; every mapped logo already carries its line color.
// Decorative: the line name always sits beside it, so the image has no alt
// text of its own. A line without a logo falls back to its color dot.
export function LineLogo({ line, size = 18 }: { line: Line; size?: number }) {
  const src = lineLogoUrl(line.id);
  if (!src) {
    return <span className="dot" style={{ background: line.color_hex }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG from
    // public/, nothing for next/image to optimize.
    <img
      className="line-logo"
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
    />
  );
}
