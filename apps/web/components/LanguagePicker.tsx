// apps/web/components/LanguagePicker.tsx
"use client";

import { useState } from "react";
import { LANGUAGES, t, type Lang } from "../lib/i18n";
import { useLang } from "../lib/lang";
import { Flag } from "./Flag";
import { CheckIcon, ChevronIcon, GlobeIcon } from "./icons";

// A row in Map settings showing the current language; it opens a list of
// every language, the unfinished ones visible but disabled ("Coming soon").
// A list rather than a two-way switch, so adding a language is one more
// entry in LANGUAGES, not a redesign. Native radios keep keyboard and
// screen-reader behavior; they are visually hidden behind the row.
export function LanguagePicker({
  onChange,
}: {
  onChange: (lang: Lang) => void;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <div className="lang-picker">
      <button
        type="button"
        className="row"
        aria-expanded={open}
        aria-controls="lang-options"
        onClick={() => setOpen((o) => !o)}
      >
        <GlobeIcon />
        <span className="row-main row-title">{t("language", lang)}</span>
        <span className="lang-current" lang={current.code}>
          {current.flag && <Flag id={current.flag} />}
          {current.native}
        </span>
        <span className="lang-chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>

      {open && (
        <fieldset id="lang-options" className="lang-options">
          <legend className="visually-hidden">{t("language", lang)}</legend>
          {LANGUAGES.map((option) => (
            <label
              key={option.code}
              className="row lang-option"
              data-disabled={!option.ready || undefined}
            >
              <input
                type="radio"
                name="lang"
                className="visually-hidden"
                value={option.code}
                checked={option.code === lang}
                disabled={!option.ready}
                onChange={() => {
                  if (!option.ready) return;
                  onChange(option.code);
                  setOpen(false);
                }}
              />
              <span className="lang-flag-slot">
                {option.flag && <Flag id={option.flag} />}
              </span>
              <span className="row-main" lang={option.code}>
                {option.native}
              </span>
              {!option.ready && (
                <span className="lang-soon">{t("coming_soon", lang)}</span>
              )}
              {option.code === lang && (
                <span className="lang-check">
                  <CheckIcon />
                </span>
              )}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
