import { describe, it, expect } from "vitest";
import { checkSourceRefs } from "./check-source-refs";
import type { Station } from "schema";

function makeStation(milestones: Station["milestones"]): Station {
  return {
    id: "A",
    name_th: "A",
    name_en: "A",
    code_history: [{ code: "A", from: "2026-01-01", to: null }],
    structure: "elevated",
    accessible: true,
    coords: { geo: { lat: 13.75, lon: 100.5 } },
    validity: [],
    milestones,
    confidence: "high",
    last_verified_at: "2026-07-01",
  };
}

describe("checkSourceRefs", () => {
  it("passes when every milestone has at least one source_ref", () => {
    const station = makeStation([
      {
        date: "2026-01-01",
        date_precision: "exact",
        event: "opened",
        source_refs: [
          { url: "https://example.com", title: "x", published_at: null },
        ],
      },
    ]);
    expect(
      checkSourceRefs({ stations: [station], lines: [], segments: [] }),
    ).toEqual([]);
  });

  it("flags a milestone with an empty source_refs array", () => {
    // Schema validation would already reject this at parse time (Task 2);
    // this check is a defense-in-depth pass over already-parsed data, e.g.
    // data mutated after parsing.
    const station = makeStation([
      {
        date: "2026-01-01",
        date_precision: "exact",
        event: "opened",
        source_refs: [],
      },
    ]);
    const violations = checkSourceRefs({
      stations: [station],
      lines: [],
      segments: [],
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("A");
  });
});
