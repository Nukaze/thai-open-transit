"use client";

import { useState } from "react";
import { t } from "../lib/i18n";
import { useLang } from "../lib/lang";

// The brand on phones, where the panel's brand row is hidden: a glass pill
// top-left, across from the theme button. Tapping folds it to the icon to
// give the map its room back, for this visit only; every load starts
// expanded.
export function MobileBrand() {
  const lang = useLang();
  const [folded, setFolded] = useState(false);

  const label = t(folded ? "brand_unfold" : "brand_fold", lang);
  return (
    <button
      type="button"
      className="mobile-brand"
      data-folded={folded || undefined}
      aria-expanded={!folded}
      aria-label={`Bangkok Open Transit - ${label}`}
      title={label}
      onClick={() => setFolded(!folded)}
    >
      {/* Same 512px mark as the panel's brand row. */}
      <img src="/route_amethyst.png" alt="" width={26} height={26} />
      {/* Outer span animates the width (grid 1fr <-> 0fr), inner one the
          slide and fade. */}
      <span className="mobile-brand-text" aria-hidden="true">
        <span className="mobile-brand-inner">
          <span className="mobile-brand-name">Bangkok Open Transit</span>
          <span className="mobile-brand-beta">{t("beta", lang)}</span>
        </span>
      </span>
    </button>
  );
}
