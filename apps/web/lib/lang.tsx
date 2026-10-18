// apps/web/lib/lang.tsx
"use client";

import { createContext, useContext } from "react";
import type { Lang } from "./i18n";

// The UI language, owned by HomeClient (detected after mount, then the
// viewer's pick) and read by every component that calls `t()`. English is
// the default because the page is prerendered in it.
export const LangContext = createContext<Lang>("en");

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Primary and secondary name for an entity carrying `name_th` / `name_en`:
 *  the current language's first, the other under it. `name_en` may be null
 *  (CLAUDE.md 5), in which case Thai stands alone. */
export function names(
  entity: { name_th: string; name_en: string | null },
  lang: Lang,
): {
  primary: string;
  primaryLang: Lang;
  secondary: string | null;
  secondaryLang: Lang;
} {
  if (lang === "th" || entity.name_en === null) {
    return {
      primary: entity.name_th,
      primaryLang: "th",
      secondary: lang === "th" ? entity.name_en : null,
      secondaryLang: "en",
    };
  }
  return {
    primary: entity.name_en,
    primaryLang: "en",
    secondary: entity.name_th,
    secondaryLang: "th",
  };
}
