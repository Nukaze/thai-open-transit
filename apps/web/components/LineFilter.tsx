// apps/web/components/LineFilter.tsx
"use client";

import type { Line } from "schema";

export function LineFilter({
  lines,
  activeLineIds,
  onToggle,
}: {
  lines: Line[];
  activeLineIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        background: "white",
        padding: 8,
      }}
    >
      {lines.map((line) => (
        <label key={line.id} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={activeLineIds.has(line.id)}
            onChange={() => onToggle(line.id)}
          />
          <span style={{ color: line.color_hex }}>{line.name_en}</span>
        </label>
      ))}
    </div>
  );
}
