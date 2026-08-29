// apps/web/lib/i18n.test.ts
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

describe("t", () => {
  it("returns the Thai string for a known key when lang is th", () => {
    expect(t("search_placeholder", "th")).toBe("ค้นหาสถานี...");
  });

  it("returns the English string for a known key when lang is en", () => {
    expect(t("search_placeholder", "en")).toBe("Search stations...");
  });

  it("falls back to the key itself when the key is unknown", () => {
    expect(t("unknown_key", "en")).toBe("unknown_key");
  });
});
