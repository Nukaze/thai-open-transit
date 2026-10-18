// apps/web/lib/devFonts.ts
//
// Developer-only font switcher (DevFontSwitcher.tsx, localhost only):
// overrides the --font-ui / --font-brand tokens from globals.css at runtime
// so fonts can be compared live. Visitors always get the CSS defaults.

export const FONT_CHOICES = {
  system: { label: "System", stack: "var(--font-system)" },
  chakra: {
    label: "Chakra Petch",
    stack: '"Chakra Petch", var(--font-system)',
  },
  // local() only (globals.css): shows if this machine has it installed.
  saochingcha: {
    label: "Sao Chingcha (local)",
    stack: '"Sao Chingcha", "Chakra Petch", var(--font-system)',
  },
  noto: {
    label: "Noto Sans Thai",
    stack: '"Noto Sans Thai", var(--font-system)',
  },
} as const;

export type FontChoice = keyof typeof FONT_CHOICES;
export const FONT_TARGETS = ["th", "en", "brand"] as const;
export type FontTarget = (typeof FONT_TARGETS)[number];
/** Unset target = keep the globals.css default. */
export type FontPicks = Partial<Record<FontTarget, FontChoice>>;

export const DEV_FONTS_KEY = "bot:dev-fonts";

function isChoice(value: unknown): value is FontChoice {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FONT_CHOICES, value)
  );
}

/** Stored JSON back to picks, dropping anything unknown. */
export function parseFontPicks(raw: string | null): FontPicks {
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const picks: FontPicks = {};
  for (const target of FONT_TARGETS) {
    const value = (parsed as Record<string, unknown>)[target];
    if (isChoice(value)) picks[target] = value;
  }
  return picks;
}

/** CSS for the picked targets, in the same shape as the globals.css tokens,
 *  so "Copy CSS" can be pasted there as is. */
export function fontPicksCss(picks: FontPicks): string {
  const rules: string[] = [];
  if (picks.en || picks.brand) {
    const decls = [
      picks.en && `  --font-ui: ${FONT_CHOICES[picks.en].stack};`,
      picks.brand && `  --font-brand: ${FONT_CHOICES[picks.brand].stack};`,
    ].filter(Boolean);
    rules.push(`:root {\n${decls.join("\n")}\n}`);
  }
  if (picks.th) {
    rules.push(
      `:root:lang(th) {\n  --font-ui: ${FONT_CHOICES[picks.th].stack};\n}`,
    );
  }
  return rules.join("\n\n");
}
