// apps/web/components/StationSearch.tsx
"use client";

import { useMemo, type RefObject } from "react";
import Fuse from "fuse.js";
import type { Line, Station } from "schema";
import { t } from "../lib/i18n";
import { ChevronIcon, CloseIcon, SearchIcon } from "./icons";

// The search field lives in the sheet header (Waymo's "Where to?") and its
// results replace the sheet body, so field and results are two components
// sharing a query that the parent owns.
export function StationSearchField({
  query,
  onQueryChange,
  onFocus,
  inputRef,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onFocus: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="search" role="search">
      <SearchIcon />
      <label className="visually-hidden" htmlFor="station-search">
        {t("search_placeholder", "en")}
      </label>
      <input
        ref={inputRef}
        id="station-search"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onFocus={onFocus}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t("search_where", "en")}
      />
      {query && (
        <button
          type="button"
          className="icon-btn"
          aria-label="Clear search"
          onClick={() => onQueryChange("")}
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
}

// Generic over `T extends Station` so callers holding a richer station type
// (`StationWithStatus`) get that exact type back from `onSelect`.
export function StationSearchResults<T extends Station>({
  stations,
  lines,
  query,
  onSelect,
}: {
  stations: T[];
  lines: Line[];
  query: string;
  onSelect: (station: T) => void;
}) {
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
  const colorByLine = useMemo(
    () => new Map(lines.map((l) => [l.id, l.color_hex])),
    [lines],
  );

  const results = fuse.search(query).slice(0, 12);

  if (results.length === 0) {
    return <p className="empty">{t("no_results", "en")}</p>;
  }

  return (
    <ul className="list fade-in" aria-label="Search results">
      {results.map(({ item }) => {
        const lineIds = [...new Set(item.validity.map((v) => v.line))];
        return (
          <li key={item.id}>
            <button
              type="button"
              className="row"
              onClick={() => onSelect(item)}
            >
              <span className="row-leading" aria-hidden="true">
                <span style={{ display: "flex", gap: 3 }}>
                  {lineIds.slice(0, 3).map((id) => (
                    <span
                      key={id}
                      className="dot"
                      style={{
                        width: 9,
                        height: 9,
                        background: colorByLine.get(id) ?? "currentColor",
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="row-main">
                <span className="row-title" style={{ display: "block" }}>
                  {item.name_en ?? item.name_th}
                </span>
                <span className="row-sub" style={{ display: "block" }}>
                  <span lang="th">{item.name_th}</span> · {item.id}
                </span>
              </span>
              <ChevronIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
