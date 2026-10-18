"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { useLang } from "../lib/lang";

const FOLDED_KEY = "bot:brand-folded";

// The brand on phones, where the panel's brand row is hidden: a glass pill
// top-left, across from the theme button. Tapping folds it to the icon to
// give the map its room back; the choice is remembered in this browser.
export function MobileBrand() {
  const lang = useLang();
  // Unfolded in the prerendered HTML; the saved choice applies after mount.
  const [folded, setFolded] = useState(false);

  useEffect(() => {
    try {
      setFolded(localStorage.getItem(FOLDED_KEY) === "1");
    } catch {
      // Storage blocked: stay unfolded.
    }
  }, []);

  const toggle = () => {
    const next = !folded;
    setFolded(next);
    try {
      localStorage.setItem(FOLDED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; the fold still works for this visit.
    }
  };

  const label = t(folded ? "brand_unfold" : "brand_fold", lang);
  return (
    <button
      type="button"
      className="mobile-brand"
      data-folded={folded || undefined}
      aria-expanded={!folded}
      aria-label={`Bangkok Open Transit - ${label}`}
      title={label}
      onClick={toggle}
    >
      {/* Same 512px mark as the panel's brand row. */}
      <img src="/route_amethyst.png" alt="" width={26} height={26} />
      <span className="mobile-brand-text" aria-hidden="true">
        <span className="mobile-brand-name">Bangkok Open Transit</span>
        <span className="mobile-brand-beta">{t("beta", lang)}</span>
      </span>
    </button>
  );
}
