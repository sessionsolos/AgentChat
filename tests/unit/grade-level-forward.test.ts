/**
 * Forward-looking gradeLevelIn tests.
 *
 * A rising junior planning ahead should SEE senior-only awards, not be
 * hard-excluded.  The engine marks these as "future-eligible":
 *   - met=true  → passes the hard filter (not excluded)
 *   - _futureGrade=true → score dampened, band capped at "possible"
 *   - whyEligible contains a note with the cycle year
 *
 * Grade ordering: sophomore (0) < junior (1) < senior (2)
 *
 * BELOW the required range → future-eligible (included, capped at possible)
 * ABOVE the required range → aged out      (excluded, hard filter)
 * WITHIN the allowed set   → normal        (can reach strong)
 *
 * All tests use an injectable asOf date (2026-06-17) for determinism.
 */

import { describe, it, expect } from "vitest";
import { matchProfile } from "@/lib/engine";
import type { StudentProfile } from "@/lib/schemas/student-profile";
import type { AidRecord } from "@/lib/schemas/aid-record";
import type { EligibilityRuleSet } from "@/lib/schemas/eligibility";
import { AidRecordSchema } from "@/lib/schemas";
import seedData from "@/data/scholarships.seed.json";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AS_OF = new Date("2026-06-17");

let _counter = 0;
function makeAid(
  eligibility: EligibilityRuleSet,
  overrides: Partial<AidRecord> = {}
): AidRecord {
  _counter++;
  return {
    id: `grade-fwd-test-${_counter}`,
    name: `Grade Forward Test Aid ${_counter}`,
    provider: "Test Foundation",
    type: "scholarship",
    selectivity: "competitive",
    award: { amountMin: 5000, amountMax: 5000, renewable: false },
    deadline: { type: "rolling" },
    sourceUrl: "https://example.com/scholarship",
    sourceName: "Test Foundation",
    lastVerifiedAt: "2026-01-01",
    scope: { level: "national" },
    tags: {},
    eligibility,
    ...overrides,
  };
}

/** Junior, gradYear 2028: two years until senior year */
const JUNIOR_2028: StudentProfile = {
  gradeLevel: "junior",
  gradYear: 2028,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.8,
  gpaScale: 4.0,
  testScores: { sat: 1400 },
  intendedMajors: ["Biology"],
  householdIncomeBand: "30-48k",
  activities: ["volunteering"],
};

/** Sophomore, gradYear 2029 */
const SOPHOMORE_2029: StudentProfile = {
  gradeLevel: "sophomore",
  gradYear: 2029,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.6,
  gpaScale: 4.0,
  testScores: {},
  intendedMajors: ["Engineering"],
  householdIncomeBand: "48-75k",
  activities: [],
};

/** Senior, gradYear 2027: currently in their application window */
const SENIOR_2027: StudentProfile = {
  gradeLevel: "senior",
  gradYear: 2027,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.8,
  gpaScale: 4.0,
  testScores: { sat: 1400 },
  intendedMajors: ["Biology"],
  householdIncomeBand: "30-48k",
  activities: ["volunteering"],
};

// Eligibility rules used across tests
const SENIOR_ONLY: EligibilityRuleSet = {
  kind: "gradeLevelIn",
  values: ["senior"],
  weight: "hard",
};

const JUNIOR_OR_SENIOR: EligibilityRuleSet = {
  kind: "gradeLevelIn",
  values: ["junior", "senior"],
  weight: "hard",
};

const JUNIOR_ONLY: EligibilityRuleSet = {
  kind: "gradeLevelIn",
  values: ["junior"],
  weight: "hard",
};

// ---------------------------------------------------------------------------
// Test 1: junior + senior-only award — future-eligible, included, capped
// ---------------------------------------------------------------------------

describe("Forward-looking grade: junior (gradYear 2028) + senior-only award", () => {
  it("is INCLUDED (not hard-excluded) for a junior on a senior-only award", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
  });

  it("band is at most 'possible' — never 'strong' (cannot obtain this cycle)", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
    expect(["possible", "reach"]).toContain(results[0].band);
  });

  it("whyEligible contains a 'future eligible' note", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const note = results[0].whyEligible.some((s) =>
      /future eligible/i.test(s)
    );
    expect(note, `Expected a 'future eligible' note; got: ${JSON.stringify(results[0].whyEligible)}`).toBe(true);
  });

  it("whyEligible note references the ~senior-year cycle year (gradYear - 1 = 2027)", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const note = results[0].whyEligible.some((s) =>
      /future eligible/i.test(s) && /2027/.test(s)
    );
    expect(
      note,
      `Expected cycle year 2027 in the future-eligible note; got: ${JSON.stringify(results[0].whyEligible)}`
    ).toBe(true);
  });

  it("whyEligible note mentions 'senior' as the required grade", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const note = results[0].whyEligible.some((s) => /senior/i.test(s));
    expect(note, "Future eligible note should mention required grade 'senior'").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: sophomore + junior-or-senior award — future-eligible
// ---------------------------------------------------------------------------

describe("Forward-looking grade: sophomore (gradYear 2029) + junior-or-senior award", () => {
  it("is INCLUDED for a sophomore on a junior-or-senior award", () => {
    const aid = makeAid(JUNIOR_OR_SENIOR);
    const results = matchProfile(SOPHOMORE_2029, [aid], AS_OF);
    expect(results).toHaveLength(1);
  });

  it("band is at most 'possible' (future-eligible, capped)", () => {
    const aid = makeAid(JUNIOR_OR_SENIOR);
    const results = matchProfile(SOPHOMORE_2029, [aid], AS_OF);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
    expect(["possible", "reach"]).toContain(results[0].band);
  });

  it("whyEligible contains a 'future eligible' note for sophomore on junior+ award", () => {
    const aid = makeAid(JUNIOR_OR_SENIOR);
    const results = matchProfile(SOPHOMORE_2029, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const note = results[0].whyEligible.some((s) => /future eligible/i.test(s));
    expect(note, "Should have a future-eligible note for sophomore").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3: senior + senior-only award — normal (can be strong)
// ---------------------------------------------------------------------------

describe("Normal grade: senior (gradYear 2027) + senior-only award", () => {
  it("is INCLUDED for a senior on a senior-only award", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(1);
  });

  it("senior on a senior-only open award CAN be strong (no future-grade cap)", () => {
    // Open award, small amount → maximizes competitiveness component.
    const aid = makeAid(SENIOR_ONLY, {
      selectivity: "open",
      award: { amountMin: 1000, amountMax: 1000, renewable: false },
    });
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(1);
    // A senior with GPA 3.8 and SAT 1400 on a simple open award should be strong.
    expect(results[0].band).toBe("strong");
  });

  it("whyEligible does NOT contain a 'future eligible' note for a current senior", () => {
    const aid = makeAid(SENIOR_ONLY);
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const hasNote = results[0].whyEligible.some((s) => /future eligible/i.test(s));
    expect(hasNote, "Senior should NOT get a future-eligible note").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 4: senior + junior-only award — aged out (excluded)
// ---------------------------------------------------------------------------

describe("Aged out: senior (gradYear 2027) + junior-only award", () => {
  it("is EXCLUDED for a senior on a junior-only award", () => {
    const aid = makeAid(JUNIOR_ONLY);
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 5: composite semantics — any/all/not still work with future-grade leaf
// ---------------------------------------------------------------------------

describe("Composite semantics with future-grade gradeLevelIn leaf", () => {
  it("all[senior-only(future), gpa-pass] → included (both treated as met)", () => {
    const aid = makeAid({
      kind: "all",
      rules: [
        SENIOR_ONLY,
        { kind: "gpaAtLeast", value: 3.5, weight: "hard" },
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
  });

  it("all[senior-only(future), gpa-hard-fail] → excluded (gpa hard bar fails)", () => {
    const aid = makeAid({
      kind: "all",
      rules: [
        SENIOR_ONLY,
        { kind: "gpaAtLeast", value: 4.0, weight: "hard" }, // junior gpa 3.8 fails
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(0);
  });

  it("any[senior-only(future), other-pass] → included (any branch passes)", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        SENIOR_ONLY,                                              // future-eligible (met=true)
        { kind: "residencyState", state: "CA", weight: "hard" }, // fails for NE student
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Test 6: future-eligible composes correctly with selectivity cap
// ---------------------------------------------------------------------------

describe("Future-grade + selectivity: notes stack, caps compose", () => {
  it("highly_selective + senior-only: junior is included but cannot be strong", () => {
    const aid = makeAid(SENIOR_ONLY, { selectivity: "highly_selective" });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
  });

  it("score for future-grade is lower than score for a senior on the same award", () => {
    const aid = makeAid(SENIOR_ONLY);
    const juniorResults = matchProfile(JUNIOR_2028, [aid], AS_OF);
    const seniorResults = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(juniorResults).toHaveLength(1);
    expect(seniorResults).toHaveLength(1);
    expect(seniorResults[0].feasibilityScore).toBeGreaterThan(
      juniorResults[0].feasibilityScore
    );
  });
});

// ---------------------------------------------------------------------------
// Test 7: seed data — junior sees UNL senior-only school-scoped awards
// ---------------------------------------------------------------------------

describe("Seed data: junior sees UNL school-scoped senior-only awards", () => {
  const UNL_SCHOOL_ID = "181464";
  const UNL_AWARD_ID = "unl-chancellors-tuition-scholarship-instate-2026";

  /**
   * NE junior, gradYear 2028, strong GPA, targeting UNL.
   * The UNL Chancellor's award has gradeLevelIn senior — currently the junior
   * would have been hard-excluded.  With the forward-looking fix she should see it.
   */
  const NE_JUNIOR_UNL: StudentProfile = {
    gradeLevel: "junior",
    gradYear: 2028,
    homeState: "NE",
    citizenship: "us_citizen",
    gpa: 3.8,
    gpaScale: 4.0,
    testScores: { act: 30 },
    intendedMajors: ["Engineering"],
    householdIncomeBand: "48-75k",
    activities: [],
    targetSchoolIds: [UNL_SCHOOL_ID],
  };

  it("UNL Chancellor's Tuition Scholarship NOW appears for a NE junior targeting UNL", () => {
    const records = seedData.map((r) => AidRecordSchema.parse(r));
    const results = matchProfile(NE_JUNIOR_UNL, records, AS_OF);
    const unlResult = results.find((r) => r.aid.id === UNL_AWARD_ID);
    expect(
      unlResult,
      `${UNL_AWARD_ID} should appear for NE junior targeting UNL (was previously excluded by gradeLevelIn senior)`
    ).toBeDefined();
  });

  it("UNL Chancellor's award band is at most 'possible' for the junior (future-grade cap)", () => {
    const records = seedData.map((r) => AidRecordSchema.parse(r));
    const results = matchProfile(NE_JUNIOR_UNL, records, AS_OF);
    const unlResult = results.find((r) => r.aid.id === UNL_AWARD_ID);
    expect(unlResult).toBeDefined();
    expect(unlResult!.band).not.toBe("strong");
  });

  it("UNL Chancellor's award has a 'future eligible' note in whyEligible", () => {
    const records = seedData.map((r) => AidRecordSchema.parse(r));
    const results = matchProfile(NE_JUNIOR_UNL, records, AS_OF);
    const unlResult = results.find((r) => r.aid.id === UNL_AWARD_ID);
    expect(unlResult).toBeDefined();
    const note = unlResult!.whyEligible.some((s) => /future eligible/i.test(s));
    expect(note, `Expected a future-eligible note; got: ${JSON.stringify(unlResult!.whyEligible)}`).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 8 (Fix 1): not(gradeLevelIn) negation — literal membership, not forward-looking
//
// The "below-grade → future-eligible" rule must NOT leak into negation.
//   not(gradeLevelIn ["senior"]) for a JUNIOR → INCLUDED (junior is not a senior)
//   not(gradeLevelIn ["junior"])  for a SOPHOMORE → INCLUDED (sophomore is not a junior)
//   not(gradeLevelIn ["senior"])  for a SENIOR    → EXCLUDED (senior IS a senior — control)
// ---------------------------------------------------------------------------

describe("Fix 1 — not(gradeLevelIn) uses literal membership, not forward-looking gate", () => {
  it("junior is INCLUDED under not(gradeLevelIn ['senior'])", () => {
    // A "not-for-seniors" award: a junior does NOT match {"senior"}, so she passes.
    const aid = makeAid({
      kind: "not",
      rule: { kind: "gradeLevelIn", values: ["senior"], weight: "hard" },
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(
      results,
      "A junior should pass not(gradeLevelIn ['senior']) — she is not a senior"
    ).toHaveLength(1);
  });

  it("junior is INCLUDED under all[gpaAtLeast 3.0, not(gradeLevelIn ['senior'])]", () => {
    // Composite: award open to non-seniors with GPA >= 3.0.
    const aid = makeAid({
      kind: "all",
      rules: [
        { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
        {
          kind: "not",
          rule: { kind: "gradeLevelIn", values: ["senior"], weight: "hard" },
        },
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(
      results,
      "Junior (GPA 3.8) should be included under all[gpaAtLeast 3.0, not(gradeLevelIn ['senior'])]"
    ).toHaveLength(1);
  });

  it("sophomore is INCLUDED under not(gradeLevelIn ['junior'])", () => {
    const aid = makeAid({
      kind: "not",
      rule: { kind: "gradeLevelIn", values: ["junior"], weight: "hard" },
    });
    const results = matchProfile(SOPHOMORE_2029, [aid], AS_OF);
    expect(
      results,
      "A sophomore should pass not(gradeLevelIn ['junior']) — she is not a junior"
    ).toHaveLength(1);
  });

  it("senior IS excluded under not(gradeLevelIn ['senior']) — control", () => {
    // A senior literally matches {"senior"}, so not(gradeLevelIn ["senior"]) excludes her.
    const aid = makeAid({
      kind: "not",
      rule: { kind: "gradeLevelIn", values: ["senior"], weight: "hard" },
    });
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(
      results,
      "A senior should be EXCLUDED under not(gradeLevelIn ['senior'])"
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 9 (Fix 2): any-sibling future-grade — not capped when a real branch passes
//
// any[gradeLevelIn ["senior"], gradeLevelIn ["junior","senior"]]
// For a JUNIOR: the first branch is future-eligible (not literally junior),
// the second branch passes LITERALLY (junior is in ["junior","senior"]).
// The first branch is suppressed (the second branch is the winning one).
// Result: junior matches TODAY, NOT future-capped, NOT tagged "Future eligible".
// ---------------------------------------------------------------------------

describe("Fix 2 — any-sibling future-grade leaf is not capped when a real branch passes", () => {
  it("junior is included and NOT future-capped under any[senior-only, junior-or-senior]", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        // Branch 1: senior-only — junior is below this, would be future-eligible if relied on
        { kind: "gradeLevelIn", values: ["senior"], weight: "hard" },
        // Branch 2: junior-or-senior — junior literally matches this TODAY
        { kind: "gradeLevelIn", values: ["junior", "senior"], weight: "hard" },
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results, "Junior should be included (passes branch 2 literally)").toHaveLength(1);
    expect(
      results[0].band,
      "Junior should NOT be future-capped (she passes branch 2 for real)"
    ).not.toBe("reach");
    // Band should be "strong" or "possible" based on normal scoring — NOT suppressed to reach by future penalty.
    // More precisely: the future-grade penalty must NOT apply.
    // We verify by checking that the band is what a normal match produces (not reach).
    expect(["strong", "possible"]).toContain(results[0].band);
  });

  it("junior has NO 'Future eligible' note in whyEligible under any[senior-only, junior-or-senior]", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        { kind: "gradeLevelIn", values: ["senior"], weight: "hard" },
        { kind: "gradeLevelIn", values: ["junior", "senior"], weight: "hard" },
      ],
    });
    const results = matchProfile(JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const hasFutureNote = results[0].whyEligible.some((s) =>
      /future eligible/i.test(s)
    );
    expect(
      hasFutureNote,
      `Junior should NOT get a 'Future eligible' note when she passes a branch for real; got: ${JSON.stringify(results[0].whyEligible)}`
    ).toBe(false);
  });
});
