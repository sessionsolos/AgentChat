/**
 * Unit tests for the feasibility engine (WS-2).
 *
 * Covers:
 *   A  Whole-system feasibility (matchProfile returns correct shape/ordering)
 *   B  residencyState predicate
 *   C  School-scoped award handling
 *   D  majorIn predicate
 *   E  incomeBandAtMost predicate
 *   F  hasActivity predicate
 *
 * Also covers: hard-filter exclusion, soft gap in whyNotPerfect,
 * score ordering, band assignment, and citation passthrough.
 *
 * All fixtures are defined inline — no external data files.
 */

import { describe, it, expect } from "vitest";
import { matchProfile } from "@/lib/engine";
import type { StudentProfile } from "@/lib/schemas/student-profile";
import type { AidRecord } from "@/lib/schemas/aid-record";
import type { EligibilityRuleSet } from "@/lib/schemas/eligibility";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const BASE_PROFILE: StudentProfile = {
  gradeLevel: "senior",
  gradYear: 2026,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.8,
  gpaScale: 4.0,
  testScores: { sat: 1420 },
  intendedMajors: ["Computer Science"],
  householdIncomeBand: "30-48k",
  activities: ["nhs", "athletics:tennis"],
};

function makeAid(
  overrides: Partial<AidRecord> & { eligibility: EligibilityRuleSet }
): AidRecord {
  return {
    id: "test-aid-1",
    name: "Test Scholarship",
    provider: "Test Foundation",
    type: "scholarship",
    award: { amountMin: 1000, amountMax: 5000, renewable: false },
    deadline: { type: "rolling" },
    sourceUrl: "https://example.com/scholarship",
    sourceName: "Example Foundation",
    lastVerifiedAt: "2025-01-01",
    scope: { level: "national" },
    tags: {},
    applyUrl: "https://example.com/apply",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A — Feasibility: whole system smoke + ordering
// ---------------------------------------------------------------------------

describe("Criterion A — matchProfile returns sorted results", () => {
  it("returns empty array when no records given", () => {
    const results = matchProfile(BASE_PROFILE, []);
    expect(results).toEqual([]);
  });

  it("excludes records that fail a hard requirement", () => {
    const aid = makeAid({
      eligibility: {
        kind: "all",
        rules: [
          // Hard gpa bar the student FAILS
          { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
        ],
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("includes records where the student passes all hard requirements", () => {
    const aid = makeAid({
      eligibility: {
        kind: "all",
        rules: [{ kind: "gpaAtLeast", value: 3.5, weight: "hard" }],
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].aid.id).toBe("test-aid-1");
  });

  it("sorts results by feasibilityScore descending", () => {
    // Aid1: very high GPA floor (close to student's GPA → lower margin)
    const aid1 = makeAid({
      id: "aid-close",
      name: "Close GPA Aid",
      eligibility: { kind: "gpaAtLeast", value: 3.75, weight: "hard" },
    });
    // Aid2: low GPA floor (lots of margin → higher score)
    const aid2 = makeAid({
      id: "aid-generous",
      name: "Generous GPA Aid",
      eligibility: { kind: "gpaAtLeast", value: 2.0, weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid1, aid2]);
    expect(results).toHaveLength(2);
    expect(results[0].feasibilityScore).toBeGreaterThanOrEqual(
      results[1].feasibilityScore
    );
    expect(results[0].aid.id).toBe("aid-generous");
  });

  it("assigns correct bands", () => {
    const strongAid = makeAid({
      id: "strong",
      name: "Strong Aid",
      eligibility: { kind: "gpaAtLeast", value: 2.0, weight: "hard" },
    });
    const results = matchProfile(
      { ...BASE_PROFILE, gpa: 4.0, testScores: { sat: 1580 } },
      [strongAid]
    );
    expect(results[0].band).toBe("strong");
  });

  it("populates citation from aid provenance fields", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
      sourceUrl: "https://example.org/",
      sourceName: "Example Org",
      lastVerifiedAt: "2025-06-01",
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results[0].citation).toEqual({
      sourceUrl: "https://example.org/",
      sourceName: "Example Org",
      lastVerifiedAt: "2025-06-01",
    });
  });
});

// ---------------------------------------------------------------------------
// B — residencyState
// ---------------------------------------------------------------------------

describe("Criterion B — residencyState predicate", () => {
  it("hard residency match: passes and explains", () => {
    const aid = makeAid({
      eligibility: { kind: "residencyState", state: "NE", weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]); // profile.homeState = "NE"
    expect(results).toHaveLength(1);
    expect(results[0].whyEligible.some((s) => s.includes("NE"))).toBe(true);
  });

  it("hard residency mismatch: excluded", () => {
    const aid = makeAid({
      eligibility: { kind: "residencyState", state: "CA", weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]); // student is in NE
    expect(results).toHaveLength(0);
  });

  it("soft residency mismatch: included but noted in whyNotPerfect", () => {
    const aid = makeAid({
      eligibility: { kind: "residencyState", state: "CA", weight: "soft" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyNotPerfect.some((s) => s.includes("CA"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C — school-scoped award handling
// ---------------------------------------------------------------------------

describe("Criterion C — school-scoped awards", () => {
  it("excludes school award when student lists schools and this one is not in list", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 2.0, weight: "soft" },
      scope: { level: "school", scorecardId: "999999" },
    });
    const profile = { ...BASE_PROFILE, targetSchoolIds: ["111111", "222222"] };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(0);
  });

  it("includes school award when it matches one of the student's target schools", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 2.0, weight: "soft" },
      scope: { level: "school", scorecardId: "111111" },
    });
    const profile = { ...BASE_PROFILE, targetSchoolIds: ["111111", "222222"] };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(1);
  });

  it("includes school award with a note when student has no targetSchoolIds", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 2.0, weight: "soft" },
      scope: { level: "school", scorecardId: "333333" },
    });
    const profile = { ...BASE_PROFILE, targetSchoolIds: undefined };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(1);
    expect(
      results[0].whyNotPerfect.some((s) => s.includes("333333"))
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D — majorIn predicate
// ---------------------------------------------------------------------------

describe("Criterion D — majorIn predicate", () => {
  it("hard majorIn: included when major matches (case-insensitive)", () => {
    const aid = makeAid({
      eligibility: {
        kind: "majorIn",
        values: ["computer science", "Engineering"],
        weight: "hard",
      },
    });
    // profile.intendedMajors = ["Computer Science"]
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyEligible.some((s) => /major/i.test(s))).toBe(true);
  });

  it("hard majorIn: excluded when major does not match", () => {
    const aid = makeAid({
      eligibility: {
        kind: "majorIn",
        values: ["Nursing", "Pre-Med"],
        weight: "hard",
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("soft majorIn mismatch: included but noted", () => {
    const aid = makeAid({
      eligibility: {
        kind: "majorIn",
        values: ["Nursing"],
        weight: "soft",
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyNotPerfect.some((s) => s.includes("Nursing"))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// E — incomeBandAtMost predicate
// ---------------------------------------------------------------------------

describe("Criterion E — incomeBandAtMost predicate", () => {
  it("hard income: passes when student band ≤ ceiling", () => {
    const aid = makeAid({
      eligibility: {
        kind: "incomeBandAtMost",
        band: "48-75k",
        weight: "hard",
      },
    });
    // profile.householdIncomeBand = "30-48k" (below ceiling)
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("hard income: excluded when student band > ceiling", () => {
    const aid = makeAid({
      eligibility: {
        kind: "incomeBandAtMost",
        band: "0-30k",
        weight: "hard",
      },
    });
    // profile.householdIncomeBand = "30-48k" (above ceiling)
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("soft income mismatch: included but noted", () => {
    const aid = makeAid({
      eligibility: {
        kind: "incomeBandAtMost",
        band: "0-30k",
        weight: "soft",
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(
      results[0].whyNotPerfect.some((s) => s.includes("0-30k"))
    ).toBe(true);
  });

  it("income headroom improves score: deeper below ceiling → higher margin", () => {
    const lowIncomeProfile = { ...BASE_PROFILE, householdIncomeBand: "0-30k" as const };
    const midIncomeProfile = { ...BASE_PROFILE, householdIncomeBand: "30-48k" as const };

    const aid = makeAid({
      eligibility: {
        kind: "incomeBandAtMost",
        band: "48-75k",
        weight: "hard",
      },
    });

    const [lowResult] = matchProfile(lowIncomeProfile, [aid]);
    const [midResult] = matchProfile(midIncomeProfile, [aid]);
    expect(lowResult.feasibilityScore).toBeGreaterThanOrEqual(
      midResult.feasibilityScore
    );
  });
});

// ---------------------------------------------------------------------------
// F — hasActivity predicate
// ---------------------------------------------------------------------------

describe("Criterion F — hasActivity predicate", () => {
  it("passes when activity tag exactly matches", () => {
    const aid = makeAid({
      eligibility: { kind: "hasActivity", tag: "nhs", weight: "hard" },
    });
    // profile.activities = ["nhs", "athletics:tennis"]
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyEligible.some((s) => s.includes("nhs"))).toBe(true);
  });

  it("passes when activity tag matches namespaced form", () => {
    const aid = makeAid({
      eligibility: { kind: "hasActivity", tag: "athletics:tennis", weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("hard activity: excluded when not present", () => {
    const aid = makeAid({
      eligibility: { kind: "hasActivity", tag: "robotics", weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("soft activity mismatch: included but noted", () => {
    const aid = makeAid({
      eligibility: { kind: "hasActivity", tag: "debate", weight: "soft" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyNotPerfect.some((s) => s.includes("debate"))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Boolean semantics: any / all / not
// ---------------------------------------------------------------------------

describe("Boolean semantics", () => {
  it("any: a hard unmet leaf in a losing branch does NOT disqualify if sibling passes", () => {
    const aid = makeAid({
      eligibility: {
        kind: "any",
        rules: [
          // Branch 1: hard residency student FAILS (NE vs CA)
          { kind: "residencyState", state: "CA", weight: "hard" },
          // Branch 2: GPA student PASSES
          { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
        ],
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("all: a hard unmet leaf disqualifies even when siblings pass", () => {
    const aid = makeAid({
      eligibility: {
        kind: "all",
        rules: [
          { kind: "gpaAtLeast", value: 3.0, weight: "hard" },   // passes
          { kind: "residencyState", state: "CA", weight: "hard" }, // fails
        ],
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("not: inverts a leaf result", () => {
    // NOT(residencyState = CA) → student is NOT from CA → met
    const aid = makeAid({
      eligibility: {
        kind: "not",
        rule: { kind: "residencyState", state: "CA", weight: "hard" },
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("not: inverted hard leaf that IS violated disqualifies", () => {
    // NOT(residencyState = NE) → student IS from NE → fails
    const aid = makeAid({
      eligibility: {
        kind: "not",
        rule: { kind: "residencyState", state: "NE", weight: "hard" },
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Missing optional fields — no auto-disqualification
// ---------------------------------------------------------------------------

describe("Missing optional profile fields", () => {
  it("missing SAT: does not hard-disqualify (treated as soft gap)", () => {
    const profileNoSat: StudentProfile = {
      ...BASE_PROFILE,
      testScores: {},
    };
    const aid = makeAid({
      eligibility: { kind: "testAtLeast", test: "sat", value: 1200, weight: "hard" },
    });
    // Per brief: missing optional field is treated as soft gap, not hard fail.
    const results = matchProfile(profileNoSat, [aid]);
    expect(results).toHaveLength(1);
    // The note should appear in whyNotPerfect since the score is missing
    expect(
      results[0].whyNotPerfect.some((s) => /SAT/i.test(s))
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Deadline urgency
// ---------------------------------------------------------------------------

describe("Deadline urgency", () => {
  it("past deadline surfaces a note in whyNotPerfect", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 3.0, weight: "soft" },
      deadline: { type: "date", date: "2020-01-01" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    expect(
      results[0].whyNotPerfect.some((s) => /passed/i.test(s))
    ).toBe(true);
  });

  it("rolling deadline produces no urgency note", () => {
    const aid = makeAid({
      eligibility: { kind: "gpaAtLeast", value: 3.0, weight: "soft" },
      deadline: { type: "rolling" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    // No urgency note for rolling deadlines
    expect(
      results[0].whyNotPerfect.some((s) => /deadline/i.test(s) && /passed/i.test(s))
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seed record integration smoke test
// ---------------------------------------------------------------------------

import seedData from "@/data/scholarships.seed.json";
import { AidRecordSchema } from "@/lib/schemas";

describe("Seed record integration", () => {
  // -------------------------------------------------------------------------
  // Test 1: checks that the coca-cola-scholars-2026 record (national, senior,
  // GPA >= 3.0 hard, no income gate) appears for a profile meeting hard rules,
  // and verifies structural invariants across all matched records.
  // (Gates Millennium was removed — it closed to new applicants after 2016.)
  // -------------------------------------------------------------------------
  it("matchProfile returns coca-cola-scholars-2026 for an eligible profile and upholds structural invariants", () => {
    const records = seedData.map((r) => AidRecordSchema.parse(r));

    // Profile that satisfies Coca-Cola hard rules:
    //   citizenshipIn us_citizen/permanent_resident (hard)
    //   gradeLevelIn senior (hard)
    //   gpaAtLeast 3.0 (hard)
    const profile: StudentProfile = {
      gradeLevel: "senior",
      gradYear: 2026,
      homeState: "CA",
      citizenship: "us_citizen",
      gpa: 3.5,
      gpaScale: 4.0,
      testScores: {},
      intendedMajors: ["Computer Science"],
      householdIncomeBand: "30-48k",
      activities: [],
    };

    const results = matchProfile(profile, records);
    expect(results.length).toBeGreaterThanOrEqual(1);

    // The specific record must be present — robust to future additions
    const cokeResult = results.find((r) => r.aid.id === "coca-cola-scholars-2026");
    expect(cokeResult).toBeDefined();
    expect(cokeResult!.whyEligible.length).toBeGreaterThan(0);

    // gates-millennium-scholars-2026 must NOT appear (program was closed after 2016)
    const gatesResult = results.find((r) => r.aid.id === "gates-millennium-scholars-2026");
    expect(gatesResult).toBeUndefined();

    // Structural invariants that should survive seed edits
    for (const result of results) {
      // Every result must have a non-empty citation sourceUrl
      expect(result.citation.sourceUrl).toBeTruthy();
      // Band must be one of the three valid values
      expect(["strong", "possible", "reach"]).toContain(result.band);
    }

    // Results are sorted by feasibilityScore descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].feasibilityScore).toBeGreaterThanOrEqual(
        results[i].feasibilityScore
      );
    }
  });

  // -------------------------------------------------------------------------
  // Test 2 (was stale): the old test assumed no award would match a profile
  // with international citizenship + low GPA + high income, but the seed
  // contains awards with no hard citizenship or GPA requirements that a
  // sophomore can still pass.
  //
  // New approach: test specific record presence/absence using awards with
  // known hard residency requirements (Nebraska-only awards).
  //
  //   * susan-buffett-scholarship-2026  — hard residencyState=NE
  //   * nebraska-opportunity-grant-2026 — hard residencyState=NE
  //
  // For a non-NE student both must be ABSENT. For a NE-eligible student
  // susan-buffett must be PRESENT (NE, senior, gpa>=2.0).
  // -------------------------------------------------------------------------
  it("Nebraska-only awards are absent for non-NE student, present for NE student", () => {
    const records = seedData.map((r) => AidRecordSchema.parse(r));

    const NE_ONLY_IDS = [
      "susan-buffett-scholarship-2026",
      "nebraska-opportunity-grant-2026",
    ];

    // Non-Nebraska student — both NE awards must be absent
    const nonNeProfile: StudentProfile = {
      gradeLevel: "senior",
      gradYear: 2026,
      homeState: "CA",
      citizenship: "us_citizen",
      gpa: 3.5,
      gpaScale: 4.0,
      testScores: {},
      intendedMajors: ["Computer Science"],
      householdIncomeBand: "30-48k",
      activities: [],
    };

    const nonNeResults = matchProfile(nonNeProfile, records);
    const nonNeIds = nonNeResults.map((r) => r.aid.id);

    for (const id of NE_ONLY_IDS) {
      expect(nonNeIds, `${id} should NOT appear for a CA student`).not.toContain(id);
    }

    // Nebraska senior with GPA ≥ 2.0 — susan-buffett must be present
    const neProfile: StudentProfile = {
      gradeLevel: "senior",
      gradYear: 2026,
      homeState: "NE",
      citizenship: "us_citizen",
      gpa: 3.0,
      gpaScale: 4.0,
      testScores: {},
      intendedMajors: ["Computer Science"],
      householdIncomeBand: "30-48k",
      activities: [],
    };

    const neResults = matchProfile(neProfile, records);
    const neIds = neResults.map((r) => r.aid.id);

    expect(
      neIds,
      "susan-buffett-scholarship-2026 must appear for a NE senior with gpa≥2.0"
    ).toContain("susan-buffett-scholarship-2026");

    // Confirm the matched award has non-empty whyEligible
    const buffettResult = neResults.find((r) => r.aid.id === "susan-buffett-scholarship-2026");
    expect(buffettResult!.whyEligible.length).toBeGreaterThan(0);
  });
});
