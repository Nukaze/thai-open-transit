// apps/web/components/Sheet.tsx
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronIcon } from "./icons";

export type Detent = "peek" | "half" | "full";

// Breakpoint where the sheet becomes a floating side panel (matches
// globals.css). Below it the sheet is a draggable bottom sheet.
const DESKTOP_QUERY = "(min-width: 768px)";
// Gap kept between the fully expanded sheet and the top of the screen, so
// the map stays visible as context and the sheet reads as a layer on it.
const TOP_GAP = 56;
// Movement before a press becomes a drag, so taps on rows and chips inside
// the sheet still register as taps.
const DRAG_SLOP = 8;

// Apple's projection (Designing Fluid Interfaces, WWDC 2018): where a flick
// would come to rest under scroll-like deceleration. Picking the detent
// nearest this point, rather than nearest the release point, is what lets a
// short flick travel a long way.
function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Progressive resistance past an edge instead of a hard stop.
function rubberband(overshoot: number, dimension: number, c = 0.55): number {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

/**
 * Waymo-style bottom sheet on phones (three detents, 1:1 drag, momentum
 * projection, interruptible spring) and a floating panel on desktop.
 *
 * Position is driven by a hand-rolled spring rather than a CSS transition:
 * a transition cannot be grabbed mid-flight and reversed without a jump, and
 * an animation library would cost bundle budget (CLAUDE.md 7) for one spring.
 */
export function Sheet({
  detent,
  onDetentChange,
  peekHeight,
  expandKey,
  header,
  children,
}: {
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
  /** Visible height in the collapsed state. */
  peekHeight: number;
  /** Any change unfolds a collapsed desktop panel (e.g. a new selection). */
  expandKey?: string | null;
  header: ReactNode;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [viewport, setViewport] = useState(0);
  // Desktop only: the floating panel folds down to its header so the map
  // gets the whole screen. Phones already collapse via the peek detent.
  const [collapsed, setCollapsed] = useState(false);

  // Live spring state. Kept in refs: it changes every frame and must never
  // cause a React render.
  const y = useRef(0);
  const v = useRef(0);
  const raf = useRef(0);
  const drag = useRef<{
    id: number;
    startY: number;
    startSheetY: number;
    active: boolean;
    history: { y: number; t: number }[];
  } | null>(null);

  const sheetHeight = Math.max(0, viewport - TOP_GAP);
  const detentY = useCallback(
    (d: Detent) => {
      if (d === "full") return 0;
      if (d === "half") return Math.max(0, sheetHeight - viewport * 0.5);
      return Math.max(0, sheetHeight - peekHeight);
    },
    [sheetHeight, viewport, peekHeight],
  );

  const write = useCallback(
    (value: number) => {
      y.current = value;
      const el = sheetRef.current;
      if (el) el.style.transform = `translate3d(0, ${value}px, 0)`;
      // Lets map chrome (attribution) sit on top of the sheet.
      document.documentElement.style.setProperty(
        "--sheet-offset",
        `${Math.max(0, sheetHeight - value)}px`,
      );
    },
    [sheetHeight],
  );

  // Spring defined by Apple's designer-facing parameters: damping ratio
  // (1 = no overshoot) and response (seconds, how quickly it gets there).
  // Always starts from the current on-screen value and velocity, so a
  // retarget mid-flight is seamless.
  const animateTo = useCallback(
    (target: number, damping = 1, response = 0.38) => {
      cancelAnimationFrame(raf.current);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) {
        v.current = 0;
        write(target);
        return;
      }
      const k = (2 * Math.PI) / response;
      const stiffness = k * k;
      const friction = (4 * Math.PI * damping) / response;
      let last = performance.now();
      const step = (now: number) => {
        let dt = Math.min(0.064, (now - last) / 1000);
        last = now;
        // Fixed substeps keep the integration stable on slow frames.
        while (dt > 0) {
          const h = Math.min(dt, 1 / 240);
          const a = -stiffness * (y.current - target) - friction * v.current;
          v.current += a * h;
          y.current += v.current * h;
          dt -= h;
        }
        if (Math.abs(y.current - target) < 0.5 && Math.abs(v.current) < 8) {
          v.current = 0;
          write(target);
          return;
        }
        write(y.current);
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [write],
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      setDesktop(mq.matches);
      setViewport(window.innerHeight);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  // Place the sheet on first layout without animating in from nowhere.
  const placed = useRef(false);
  // Set on release when the drag itself already started the spring toward
  // the new detent, so the detent change below doesn't restart it with the
  // default (bounce-free) spring and lose the flick's momentum.
  const settling = useRef<Detent | null>(null);
  useLayoutEffect(() => {
    if (desktop || !viewport) {
      document.documentElement.style.setProperty("--sheet-offset", "0px");
      return;
    }
    const target = detentY(detent);
    if (!placed.current) {
      placed.current = true;
      write(target);
    } else if (settling.current === detent) {
      settling.current = null;
    } else if (!drag.current?.active) {
      animateTo(target);
    }
  }, [detent, desktop, viewport, detentY, write, animateTo]);

  // At full height the body scrolls. While it is scrolled to the top it
  // hands the browser only upward swipes (`pan-down` = scroll the content
  // down), so a downward drag stays a pointer drag that moves the sheet
  // instead of the browser claiming it and firing pointercancel.
  const syncAtTop = useCallback(() => {
    const body = bodyRef.current;
    if (body) body.toggleAttribute("data-at-top", body.scrollTop <= 0);
  }, []);
  useLayoutEffect(syncAtTop, [syncAtTop, detent, children]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Opening a station unfolds the panel, or its details would land in a
  // hidden body. Keyed on the selection itself, not the detent, because
  // picking a second station leaves the detent unchanged.
  useEffect(() => {
    if (expandKey) setCollapsed(false);
  }, [expandKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (desktop || e.button !== 0) return;
    settling.current = null;
    const target = e.target as HTMLElement;
    // Inputs keep their own gestures (text selection, slider, color).
    if (target.closest("input, textarea, [data-no-drag]")) return;
    // Fully open: the body scrolls; only the grabber/header drag the sheet,
    // or the body when it is already scrolled to the top.
    const inBody = bodyRef.current?.contains(target);
    if (detent === "full" && inBody && (bodyRef.current?.scrollTop ?? 0) > 0)
      return;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      startSheetY: y.current,
      active: false,
      history: [{ y: e.clientY, t: e.timeStamp }],
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      // At full height, an upward drag in the body is a scroll, not a drag.
      if (
        detent === "full" &&
        dy < 0 &&
        bodyRef.current?.contains(e.target as Node)
      ) {
        drag.current = null;
        return;
      }
      d.active = true;
      // Grab the sheet where it is right now, even mid-animation.
      cancelAnimationFrame(raf.current);
      d.startY = e.clientY;
      d.startSheetY = y.current;
      sheetRef.current?.setPointerCapture(e.pointerId);
    }
    d.history.push({ y: e.clientY, t: e.timeStamp });
    if (d.history.length > 6) d.history.shift();
    const raw = d.startSheetY + (e.clientY - d.startY);
    const max = detentY("peek");
    let next = raw;
    if (raw < 0) next = -rubberband(-raw, sheetHeight);
    else if (raw > max) next = max + rubberband(raw - max, sheetHeight);
    write(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.active) return;
    // Release velocity from the last ~100ms of movement.
    const recent = d.history.filter((p) => e.timeStamp - p.t < 100);
    const first = recent[0] ?? d.history[0]!;
    const last = d.history[d.history.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    const velocity = dt > 0 ? (last.y - first.y) / dt : 0;
    v.current = velocity;

    const projected = y.current + project(velocity);
    const detents: Detent[] = ["full", "half", "peek"];
    const nearest = detents.reduce((best, cand) =>
      Math.abs(detentY(cand) - projected) < Math.abs(detentY(best) - projected)
        ? cand
        : best,
    );
    // A little bounce only when the gesture carried momentum.
    animateTo(detentY(nearest), Math.abs(velocity) > 400 ? 0.82 : 1, 0.34);
    if (nearest !== detent) {
      settling.current = nearest;
      onDetentChange(nearest);
    }
  };

  return (
    <div
      ref={sheetRef}
      className="sheet"
      data-detent={desktop ? "full" : detent}
      data-collapsed={desktop && collapsed ? "true" : undefined}
      role="region"
      aria-label="Map panel"
      // The prerendered HTML has no measurements, so CSS places the sheet at
      // the peek from `--peek-height` until JS takes over with exact pixels.
      style={
        {
          "--peek-height": `${peekHeight}px`,
          height: !desktop && sheetHeight ? sheetHeight : undefined,
        } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        type="button"
        className="sheet-grabber"
        aria-label={detent === "peek" ? "Expand panel" : "Collapse panel"}
        onClick={() => onDetentChange(detent === "peek" ? "half" : "peek")}
      />
      <button
        type="button"
        className="sheet-collapse"
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronIcon size={16} />
      </button>
      {/* Focusing search unfolds the panel so results have somewhere to go. */}
      <div className="sheet-head" onFocus={() => setCollapsed(false)}>
        {header}
      </div>
      {/* The fold wrapper animates the collapse (globals.css); `hidden` would
          snap shut. `inert` keeps the folded body out of the tab order. */}
      <div className="sheet-fold" inert={desktop && collapsed}>
        <div ref={bodyRef} className="sheet-body" onScroll={syncAtTop}>
          {children}
        </div>
      </div>
    </div>
  );
}
