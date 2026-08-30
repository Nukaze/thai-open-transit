// apps/web/components/StationSearch.tsx
"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { Station } from "schema";

// Generic over `T extends Station` rather than hardcoding `Station` (the
// brief's literal Step 6 signature): the caller in this app, `HomeClient.tsx`,
// holds `StationWithStatus[]` (`Station & { status: Status }`, see
// `apps/web/lib/types.ts`) and needs `onSelect` to hand back the full
// `StationWithStatus` so it can feed `setSelectedStation` (typed
// `StationWithStatus | null`) without a cast. `T extends Station` keeps the
// brief's `Station[]` / `(station: Station) => void` shape as the default
// instantiation while staying exact for callers with a richer station type.
export function StationSearch<T extends Station>({
  stations,
  onSelect,
}: {
  stations: T[];
  onSelect: (station: T) => void;
}) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(stations, {
        // `code_history.code` is a Fuse dot-notation path into the array,
        // so it matches every historical code a station has carried, not
        // just the current one. Station code and station id diverge over
        // time (CLAUDE.md 9 - the Sukhumvit extension renumbered stations),
        // so someone searching the code printed on an older sign or map
        // would otherwise find nothing.
        keys: ["name_th", "name_en", "id", "code_history.code"],
        threshold: 0.3,
      }),
    [stations],
  );

  const results = query ? fuse.search(query).slice(0, 8) : [];

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        background: "white",
        padding: 8,
      }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search stations..."
      />
      <ul>
        {results.map(({ item }) => (
          <li key={item.id}>
            <button onClick={() => onSelect(item)}>
              {item.name_en ?? item.name_th} ({item.id})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
