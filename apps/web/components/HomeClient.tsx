// apps/web/components/HomeClient.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { StationPanel } from "./StationPanel";
import { LineFilter } from "./LineFilter";
import { StationSearchField, StationSearchResults } from "./StationSearch";
import { ThemeSegmented, ThemeToggle } from "./ThemeToggle";
import { Sheet, type Detent } from "./Sheet";
import { detectLang, t, type Lang } from "../lib/i18n";
import { LangContext } from "../lib/lang";
import { LanguagePicker } from "./LanguagePicker";
import { VisitCounter } from "./VisitCounter";
import { YearSelector } from "./YearSelector";
import { SelectionRingColorPicker } from "./SelectionRingColorPicker";
import { NearestStationChip } from "./NearestStationChip";
import { nearestStations } from "../lib/nearest-station";
import { getStationIdFromUrl, buildStationDeepLink } from "../lib/deep-link";
import { isValidAt } from "../lib/asOf";
import {
  buildPrefixLineIndex,
  lineColorIndex,
  pickLabelledStations,
  resolveStationLabel,
} from "../lib/stationLabel";
import { StationLabelsToggle } from "./StationLabelsToggle";
import type { Line } from "schema";
import type { FeatureCollection, Point, LineString } from "geojson";
import type { StationWithStatus } from "../lib/types";
import type { MapFocus, MapTheme } from "./Map";

// `maplibre-gl` and friends (pmtiles, @protomaps/basemaps) are ~270KB gzipped
// on their own - CLAUDE.md 7's "First load, compressed: < 300 KB" budget
// can't absorb them in the initial bundle. `next/dynamic` with `ssr: false`
// moves `Map.tsx` (and everything it imports) into a separate chunk that
// downloads after hydration instead of blocking First Contentful Paint. The
// `.then` resolves the named `Map` export to the default export shape
// `next/dynamic` requires.
const NetworkMap = dynamic(
  () => import("./Map").then((mod) => ({ default: mod.Map })),
  {
    ssr: false,
    loading: () => <div className="map-canvas" />,
  },
);

// Visible sheet height on phones when collapsed: grabber, search field, the
// one-line lines hint and the first line group (its label + chip row), with
// the section's Show all / Hide all in reach. The other groups are a swipe
// up away (half detent).
const PEEK_HEIGHT = 226;

// localStorage key for the viewer's chosen UI language.
const LANG_KEY = "bot:lang";

export function HomeClient({
  stations,
  lines,
  networkGeoJson,
}: {
  stations: StationWithStatus[];
  lines: Line[];
  networkGeoJson: FeatureCollection<Point | LineString>;
}) {
  const [activeLineIds, setActiveLineIds] = useState(
    new Set(lines.map((l) => l.id)),
  );
  const [selectedStation, setSelectedStation] =
    useState<StationWithStatus | null>(null);
  // Per-theme, per-viewer only, no persistence (not asked for) - resets to
  // these defaults on reload. Separate colors per theme because a color that
  // reads clearly against the dark flavor's near-black land often disappears
  // (or looks wrong) against the light flavor's near-white land, and vice
  // versa - same reason `OVERLAY_COLORS` in Map.tsx varies station-dot color
  // by theme. `SelectionRingColorPicker` always edits whichever entry
  // matches the theme currently on screen.
  const [selectionRingColors, setSelectionRingColors] = useState<
    Record<MapTheme, string>
  >({
    light: "#FF0000",
    dark: "#FFFFFF",
  });
  // Starts dark rather than reading `prefers-color-scheme` during render:
  // this component is prerendered to static HTML at build time, where no
  // media query exists, so branching on it here would produce markup that
  // disagrees with the client's first paint. The effect below applies the
  // OS preference after mount, and any explicit toggle then wins.
  const [theme, setTheme] = useState<MapTheme>("dark");
  // Station code badges and name labels. On by default; per-viewer and not
  // persisted, the same as theme and ring color.
  const [showStationLabels, setShowStationLabels] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    if (query.matches) setTheme("light");
  }, []);

  // UI language: prerendered in English like `theme` above, then after
  // mount the viewer's saved pick, else the browser's preferred languages.
  // Unlike theme it is remembered: a language is a standing preference.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_KEY);
    } catch {
      // Storage blocked (private mode, sandbox): fall through to detection.
    }
    setLang(
      saved === "en" || saved === "th"
        ? saved
        : detectLang(navigator.languages ?? [navigator.language]),
    );
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const chooseLang = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Not persisted; the pick still holds for this visit.
    }
  };

  // Same prerendered-at-build-time problem as `theme` above: `output:'export'`
  // bakes whatever `new Date()` returns into the static HTML once, at build
  // time, so it can go stale for however long the site sits undeployed.
  // `selectedYear` stays `null` (meaning "unfiltered by date", the same
  // network the map showed before this feature existed) until this effect
  // resolves the visitor's actual current year after mount.
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  useEffect(() => {
    setSelectedYear(new Date().getFullYear());
  }, []);

  // The earliest year any station's line membership began - the slider's
  // lower bound. Derived from data rather than hardcoded so a future earlier
  // seed (or a later one) doesn't need this component touched.
  const minYear = useMemo(
    () =>
      Math.min(
        ...stations.flatMap((s) =>
          s.validity.map((v) => Number(v.from.slice(0, 4))),
        ),
      ),
    [stations],
  );

  // Past years query as of Dec 31 (matching the existing seed snapshots'
  // convention, e.g. "seed the 2019-12-31 network snapshot"); the current
  // year queries as of today rather than a not-yet-arrived year-end.
  const selectedDate = useMemo(() => {
    if (selectedYear === null) return null;
    const currentYear = new Date().getFullYear();
    return selectedYear === currentYear
      ? new Date().toISOString().slice(0, 10)
      : `${selectedYear}-12-31`;
  }, [selectedYear]);

  // Stable across re-renders as long as the `stations` prop (loaded once at
  // build time) doesn't change, so it doesn't force `Map`'s effect (which
  // depends on this callback) to tear down and recreate the map on every
  // unrelated render.
  const stationById = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations],
  );
  const lineColorById = useMemo(() => lineColorIndex(lines), [lines]);
  const prefixLine = useMemo(() => buildPrefixLineIndex(stations), [stations]);
  // Deep-link write: selecting a station - from the map or from search -
  // opens its panel and pushes a shareable `?station=` URL via
  // `buildStationDeepLink`, so a copied URL reopens the same station on load
  // (via the read-side effect below). Both selection paths route through
  // this one handler so "shareable deep links" (this task's commit message)
  // actually covers the primary interaction (clicking a station on the map),
  // not just the new search box.
  const handleSelectStation = useCallback((station: StationWithStatus) => {
    setSelectedStation(station);
    window.history.replaceState(null, "", buildStationDeepLink(station.id));
  }, []);

  // Deep-link read: on mount, check the URL for a `?station=` param (per
  // brief Step 7 - originally written against `page.tsx`, redirected here
  // since Task 15 moved all interactive state into this Client Component)
  // and open that station's panel if it exists in this build's data. Runs
  // once per `stationById` identity (stable across re-renders per the
  // `useMemo` above, so effectively "once on mount" in practice) rather than
  // on every render. Uses `setSelectedStation` directly rather than
  // `handleSelectStation` - the URL already has this param, so rewriting it
  // via `replaceState` here would be a harmless but pointless no-op.
  // Remembers which station the link opened, so the map flies to it (below).
  const deepLinkIdRef = useRef<string | null>(null);
  useEffect(() => {
    const stationId = getStationIdFromUrl(window.location.href);
    if (stationId) {
      const station = stationById.get(stationId);
      if (station) {
        deepLinkIdRef.current = station.id;
        setSelectedStation(station);
      }
    }
  }, [stationById]);

  // The line filter has to branch on geometry: a station Point is visible when
  // any line it serves is active, whereas a segment LineString carries its own
  // `line` id and is visible when that one line is active. Testing every
  // feature against `visibleStationIds` (as this did before segments existed)
  // would drop every LineString, since a segment id is never a station id.
  //
  // The date filter (`selectedDate === null` means unfiltered, matching
  // pre-feature behavior) layers on top of that, per feature type: a station
  // is visible when the SAME validity window that grants it an active line
  // also covers the date (a station's line membership and its open dates
  // travel together on one window), a segment when any of its own validity
  // windows - denormalized onto the geojson feature by `assembleNetwork` -
  // covers the date.
  // Hoisted out of `filteredGeoJson` so the nearest-station lookup below
  // searches exactly the stations the map is drawing, not a second copy of
  // the filter that could drift from it.
  const visibleStations = useMemo(
    () =>
      stations.filter((s) =>
        s.validity.some(
          (v) =>
            activeLineIds.has(v.line) &&
            (selectedDate === null || isValidAt(v, selectedDate)),
        ),
      ),
    [activeLineIds, stations, selectedDate],
  );

  const filteredGeoJson = useMemo(() => {
    const visibleStationIds = new Set(visibleStations.map((s) => s.id));

    // Station labels (code badge + name) depend on the same date and line
    // filter as visibility - a code changes on renumbering, a two-line
    // station's ring and codes change with the line filter - so they are
    // resolved here, per render of the filter, and written onto the feature
    // properties the map's symbol layers read. Nothing label-related is baked
    // into network.geojson at build time; `stations` already carries it.
    const labels = new Map(
      visibleStations.map((s) => [
        s.id,
        resolveStationLabel(
          s,
          selectedDate,
          activeLineIds,
          lineColorById,
          prefixLine,
        ),
      ]),
    );
    const labelled = pickLabelledStations(
      visibleStations.map((s) => ({
        id: s.id,
        name_th: s.name_th,
        interchange_group: s.interchange_group,
        openedFrom: labels.get(s.id)?.openedFrom ?? "",
      })),
    );

    return {
      ...networkGeoJson,
      features: networkGeoJson.features.flatMap((f) => {
        if (f.geometry.type === "LineString") {
          if (!activeLineIds.has(f.properties?.line)) return [];
          if (selectedDate === null) return [f];
          const validity = (f.properties?.validity ?? []) as {
            from: string;
            to: string | null;
          }[];
          return validity.some((v) => isValidAt(v, selectedDate)) ? [f] : [];
        }
        const id = f.properties?.id as string;
        if (!visibleStationIds.has(id)) return [];
        const label = labels.get(id)!;
        return [
          {
            ...f,
            properties: {
              ...f.properties,
              status: stationById.get(id)?.status,
              // Newline-joined: a two-code station (PP16 over BL10) renders
              // as a stacked badge, the way printed Bangkok maps show it.
              codes: label.codes.join("\n"),
              ring_color: label.ringColor,
              show_name: labelled.has(id),
              // Lower places first in MapLibre symbol collision, so
              // interchanges (multi-code or multi-line) keep their badge
              // when a crowded zoom has to drop some.
              label_rank: label.codes.length > 1 || label.interchange ? 0 : 1,
            },
          },
        ];
      }),
    } as FeatureCollection<Point | LineString>;
  }, [
    visibleStations,
    stationById,
    networkGeoJson,
    selectedDate,
    activeLineIds,
    lineColorById,
    prefixLine,
  ]);

  // Device position from the map's geolocate control. Never leaves the
  // browser: the public plane is static (CLAUDE.md 2.4), so there is nowhere
  // to send it, and nothing here should start doing so.
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [geolocateError, setGeolocateError] = useState<number | null>(null);

  const handleUserLocation = useCallback(
    (coords: { lat: number; lon: number; accuracy: number }) => {
      setUserLocation({ lat: coords.lat, lon: coords.lon });
      setGeolocateError(null);
    },
    [],
  );

  // A GPS fix answers "where can I board now", so only stations a rider can
  // actually use today count, on top of whatever the map is showing.
  // `status` is the build-time derived current state (CLAUDE.md 9).
  const nearest = useMemo(() => {
    if (!userLocation) return null;
    const boardable = visibleStations.filter(
      (s) => s.status === "operational" || s.status === "trial",
    );
    return nearestStations(userLocation, boardable, 1)[0] ?? null;
  }, [userLocation, visibleStations]);

  // Sheet state. A selected station opens the sheet halfway, the way Waymo
  // raises its trip card; focusing search opens it fully for the keyboard.
  const [detent, setDetent] = useState<Detent>("peek");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Where the map should fly to. A fresh object per request (with `n`), so
  // picking the same station twice still re-centres on it.
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const flyTo = useCallback((station: StationWithStatus) => {
    const { lon, lat } = station.coords.geo;
    setFocus((prev) => ({ lon, lat, n: (prev?.n ?? 0) + 1 }));
  }, []);

  const openStation = useCallback(
    (station: StationWithStatus, fly: boolean) => {
      setQuery("");
      searchRef.current?.blur();
      handleSelectStation(station);
      if (fly) flyTo(station);
      // Drop out of the full-height search state so the map is visible again.
      setDetent("half");
    },
    [handleSelectStation, flyTo],
  );

  // Picked from a list (search results, nearest station): the station may be
  // anywhere, so the map flies to it.
  const selectFromSheet = useCallback(
    (station: StationWithStatus) => openStation(station, true),
    [openStation],
  );

  // A station clicked on the map wins over an in-progress search: the body
  // shows search results whenever `query` is non-empty, so without clearing
  // it here the clicked station's details would stay hidden behind them.
  // The map doesn't move: the station is already where the user clicked.
  const selectFromMap = useCallback(
    (id: string) => {
      const station = stationById.get(id);
      if (station) openStation(station, false);
      else setSelectedStation(null);
    },
    [stationById, openStation],
  );

  // A shared `?station=` link: fly there once on load, like a search pick.
  // Keyed on the id the deep-link read recorded, not on the URL, because
  // every later selection writes the same `?station=` param.
  useEffect(() => {
    if (selectedStation && selectedStation.id === deepLinkIdRef.current) {
      deepLinkIdRef.current = null;
      flyTo(selectedStation);
    }
  }, [selectedStation, flyTo]);

  // Opening a station from the map (or a deep link) raises the sheet so its
  // details are visible; closing drops it back to the peek.
  useEffect(() => {
    if (selectedStation) setDetent((d) => (d === "full" ? d : "half"));
  }, [selectedStation]);

  const closeStation = useCallback(() => {
    setSelectedStation(null);
    setDetent("peek");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // The UI chrome follows the map theme so the two never disagree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  let body: ReactNode;
  if (query.trim()) {
    body = (
      <StationSearchResults
        stations={stations}
        lines={lines}
        query={query.trim()}
        onSelect={selectFromSheet}
      />
    );
  } else if (selectedStation) {
    body = (
      <StationPanel
        station={selectedStation}
        lines={lines}
        onClose={closeStation}
      />
    );
  } else {
    body = (
      <>
        {/* Line chips come first: PEEK_HEIGHT only fits the first group, and a
            nearest-station row above it would push the chips out of the
            collapsed sheet once a location fix (or error) arrives. */}
        <LineFilter
          lines={lines}
          activeLineIds={activeLineIds}
          onToggle={(id) =>
            setActiveLineIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })
          }
          onShowAll={() => setActiveLineIds(new Set(lines.map((l) => l.id)))}
          onHideAll={() => setActiveLineIds(new Set())}
          onSetLines={(ids, visible) =>
            setActiveLineIds((prev) => {
              const next = new Set(prev);
              for (const id of ids) visible ? next.add(id) : next.delete(id);
              return next;
            })
          }
        />
        <NearestStationChip
          nearest={nearest}
          errorCode={geolocateError}
          onSelect={selectFromSheet}
        />
        <section className="section">
          <h2 className="section-title">{t("map_settings", lang)}</h2>
          <div className="list">
            <ThemeSegmented theme={theme} onChange={setTheme} />
            <LanguagePicker onChange={chooseLang} />
            <StationLabelsToggle
              on={showStationLabels}
              onChange={setShowStationLabels}
            />
            <SelectionRingColorPicker
              theme={theme}
              color={selectionRingColors[theme]}
              onChange={(color) =>
                setSelectionRingColors((prev) => ({ ...prev, [theme]: color }))
              }
            />
          </div>
        </section>
        {/* Last: dragging the year fades the rest of the sheet away (see
            YearSelector), so from the bottom the whole map above it shows
            the network change - and the bottom is where a thumb lands on
            a raised sheet. */}
        {selectedYear !== null && (
          <YearSelector
            year={selectedYear}
            minYear={minYear}
            maxYear={new Date().getFullYear()}
            onChange={setSelectedYear}
          />
        )}
        <nav className="footer-links" aria-label={t("project", lang)}>
          <a href="/download">{t("download_dataset", lang)}</a>
          <a
            href="https://github.com/Nukaze/bangkok-open-transit"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <VisitCounter />
        </nav>
      </>
    );
  }

  return (
    <LangContext.Provider value={lang}>
      <NetworkMap
        networkGeoJson={filteredGeoJson}
        onStationClick={selectFromMap}
        focus={focus}
        theme={theme}
        selectedStationId={selectedStation?.id ?? null}
        selectionRingColor={selectionRingColors[theme]}
        showStationLabels={showStationLabels}
        onUserLocation={handleUserLocation}
        onGeolocateError={setGeolocateError}
      />
      <div className="fab-stack">
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>
      <Sheet
        detent={detent}
        onDetentChange={setDetent}
        peekHeight={PEEK_HEIGHT}
        expandKey={selectedStation?.id ?? null}
        header={
          <>
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                {/* The favicon itself, so the panel and the tab can't drift
                    apart. Root-relative per CLAUDE.md 3 (no hardcoded domain). */}
                <img src="/favicon.ico" alt="" width={22} height={22} />
              </span>
              <span className="brand-name">Bangkok Open Transit</span>
            </div>
            <StationSearchField
              query={query}
              onQueryChange={setQuery}
              onFocus={() => setDetent("full")}
              inputRef={searchRef}
            />
          </>
        }
      >
        {body}
      </Sheet>
    </LangContext.Provider>
  );
}
