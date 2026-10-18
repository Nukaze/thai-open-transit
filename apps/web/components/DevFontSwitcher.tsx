"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { useLang } from "../lib/lang";
import { isLocalDev } from "../lib/visitCounter";
import {
  DEV_FONTS_KEY,
  FONT_CHOICES,
  FONT_TARGETS,
  fontPicksCss,
  parseFontPicks,
  type FontChoice,
  type FontPicks,
  type FontTarget,
} from "../lib/devFonts";

const STYLE_ID = "dev-fonts";
const LABEL_KEY: Record<FontTarget, string> = {
  th: "dev_font_th",
  en: "dev_font_en",
  brand: "dev_font_brand",
};

// The override lives in its own <style> at the end of <head>, so it wins
// over globals.css at equal specificity. It stays when the panel unmounts
// (station view), so the picked fonts don't flicker back.
function applyPicks(picks: FontPicks) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = fontPicksCss(picks);
}

// Live font comparison on the developer's machine only (isLocalDev, same
// rule as the view counter's dev badge). Picks persist in this browser;
// visitors never see this and always get the globals.css defaults - "Copy
// CSS" is how a pick becomes the default.
export function DevFontSwitcher() {
  const lang = useLang();
  const [localDev, setLocalDev] = useState(false);
  const [picks, setPicks] = useState<FontPicks>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLocalDev(process.env.NODE_ENV, location.hostname)) return;
    setLocalDev(true);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(DEV_FONTS_KEY);
    } catch {
      // Storage blocked: start from the defaults.
    }
    const initial = parseFontPicks(stored);
    setPicks(initial);
    applyPicks(initial);
  }, []);

  if (!localDev) return null;

  const update = (next: FontPicks) => {
    setPicks(next);
    setCopied(false);
    applyPicks(next);
    try {
      localStorage.setItem(DEV_FONTS_KEY, JSON.stringify(next));
    } catch {
      // Not persisted; the live preview still works.
    }
  };

  const pick = (target: FontTarget, value: string) => {
    const next = { ...picks };
    if (value === "") delete next[target];
    else next[target] = value as FontChoice;
    update(next);
  };

  const copy = () => {
    navigator.clipboard
      .writeText(fontPicksCss(picks))
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <section className="section dev-fonts">
      <h2 className="section-title">{t("dev_fonts", lang)}</h2>
      <div className="list">
        {FONT_TARGETS.map((target) => (
          <label key={target} className="row">
            <span className="row-main row-title">
              {t(LABEL_KEY[target], lang)}
            </span>
            <select
              value={picks[target] ?? ""}
              onChange={(e) => pick(target, e.target.value)}
            >
              <option value="">{t("dev_font_default", lang)}</option>
              {Object.entries(FONT_CHOICES).map(([id, choice]) => (
                <option key={id} value={id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="row dev-fonts-actions">
          <button type="button" onClick={() => update({})}>
            {t("dev_font_reset", lang)}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={Object.keys(picks).length === 0}
          >
            {t(copied ? "dev_font_copied" : "dev_font_copy", lang)}
          </button>
        </div>
      </div>
    </section>
  );
}
