// apps/web/components/StationLabelsToggle.tsx
"use client";

import { useLang } from "../lib/lang";
import { t } from "../lib/i18n";

export function StationLabelsToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const lang = useLang();
  return (
    <button
      type="button"
      className="row"
      onClick={() => onChange(!on)}
      // A real on/off toggle: the label stays fixed ("Station labels") and
      // `aria-pressed` carries the state, so the two never contradict.
      aria-pressed={on}
    >
      <span className="row-main row-title">{t("station_labels", lang)}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}
