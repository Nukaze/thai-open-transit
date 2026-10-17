// apps/web/components/YearSelector.tsx
"use client";

export function YearSelector({
  year,
  minYear,
  maxYear,
  onChange,
}: {
  year: number;
  minYear: number;
  maxYear: number;
  onChange: (year: number) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        padding: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <input
        type="range"
        min={minYear}
        max={maxYear}
        step={1}
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span>{year === maxYear ? "Today" : year}</span>
    </div>
  );
}
