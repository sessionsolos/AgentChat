/**
 * Unit tests for composite boolean semantics in the evaluation engine.
 *
 * Covers the De Morgan-correct not/any/all fix (WS-2 review finding B).
 *
 *   G  NOT(all[pass, fail]) → eligible (NOT inverts the all-node's false result)
 *   H  NOT(all[pass, pass]) → excluded (NOT inverts the all-node's true result)
 *   I  any[hard-fail branch, passing branch] → eligible, no whyNotPerfect from failing branch
 *   J  Nested composite: NOT(any[hard-fail, hard-fail]) → eligible when no branch passes
 *   K  Nested composite: NOT(any[hard-pass, hard-fail]) → excluded when any branch passes
 */

import { describe, it, expect } from "vitest";
import { matchProfile } from "@/lib/engine";
import type { StudentProfile } from "@/lib/schemas/student-profile";
import type { AidRecord } from "@/lib/schemas/aid-record";
import type { EligibilityRuleSet } from "@/lib/schemas/eligibility";

// ---------------------------------------------------------------------------
// Fixture helpers
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
  activities: ["nhs"],
};

let _aidCounter = 0;
function makeAid(
  eligibility: EligibilityRuleSet,
  overrides: Partial<AidRecord> = {}
): AidRecord {
  _aidCounter++;
  return {
    id: `composite-test-${_aidCounter}`,
    name: `Composite Test Aid ${_aidCounter}`,
    provider: "Test Foundation",
    type: "scholarship",
    selectivity: "competitive",
    award: { amountMin: 1000, amountMax: 5000, renewable: false },
    deadline: { type: "rolling" },
    sourceUrl: "https://example.com/scholarship",
    sourceName: "Example Foundation",
    lastVerifiedAt: "2025-01-01",
    scope: { level: "national" },
    tags: {},
    applyUrl: "https://example.com/apply",
    eligibility,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// G — NOT(all[pass, fail]) must be ELIGIBLE
//
// Profile: NE, GPA 3.8
// NOT( all[ residencyState=NE (PASS), gpaAtLeast 4.0 (FAIL) ] )
//   inner all evaluates to false (one child fails)
//   NOT(false) = true → student is eligible
// ---------------------------------------------------------------------------

describe("Criterion G — NOT(all[pass, fail]) is eligible", () => {
  it("NOT(all[residency=NE met, gpa≥4.0 unmet]) → eligible (inner all fails, NOT flips)", () => {
    const aid = makeAid({
      kind: "not",
      rule: {
        kind: "all",
        rules: [
          { kind: "residencyState", state: "NE", weight: "hard" },
          { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
        ],
      },
    });
    // Student is NE (residency passes) but GPA 3.8 < 4.0 (GPA fails).
    // The inner all is false → NOT(false) = true → student is eligible.
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("NOT(all[pass, fail]) whyEligible is non-empty (not gate satisfied)", () => {
    const aid = makeAid({
      kind: "not",
      rule: {
        kind: "all",
        rules: [
          { kind: "residencyState", state: "NE", weight: "hard" },
          { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
        ],
      },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    // There should be some explanation of why they passed the not gate.
    // whyEligible or whyNotPerfect should be populated.
    expect(
      results[0].whyEligible.length + results[0].whyNotPerfect.length
    ).toBeGreaterThan(0);
  });

  it("no mechanical 'NOT:' prefix in whyEligible descriptions", () => {
    const aid = makeAid({
      kind: "not",
      rule: { kind: "residencyState", state: "CA", weight: "hard" },
    });
    // NOT(residencyState=CA) → student is NE, not CA → NOT gate satisfied
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    for (const desc of results[0].whyEligible) {
      expect(desc).not.toMatch(/^NOT:/);
    }
    for (const desc of results[0].whyNotPerfect) {
      expect(desc).not.toMatch(/^NOT:/);
    }
  });
});

// ---------------------------------------------------------------------------
// H — NOT(all[pass, pass]) must be EXCLUDED
//
// Profile: NE, GPA 3.8
// NOT( all[ residencyState=NE (PASS), gpaAtLeast 2.0 (PASS) ] )
//   inner all evaluates to true (both children pass)
//   NOT(true) = false → student is excluded
// ---------------------------------------------------------------------------

describe("Criterion H — NOT(all[pass, pass]) is excluded", () => {
  it("NOT(all[residency=NE met, gpa≥2.0 met]) → excluded (inner all passes, NOT flips)", () => {
    const aid = makeAid({
      kind: "not",
      rule: {
        kind: "all",
        rules: [
          { kind: "residencyState", state: "NE", weight: "hard" },
          { kind: "gpaAtLeast", value: 2.0, weight: "hard" },
        ],
      },
    });
    // Student is NE (passes) and GPA 3.8 ≥ 2.0 (passes).
    // The inner all is true → NOT(true) = false → student is excluded.
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });

  it("NOT(single hard leaf that is met) → excluded", () => {
    // NOT(residencyState=NE) — student IS from NE — so NOT gate fails
    const aid = makeAid({
      kind: "not",
      rule: { kind: "residencyState", state: "NE", weight: "hard" },
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// I — any[hard-fail branch, passing branch] → eligible, no misleading whyNotPerfect
//
// Profile: NE student, GPA 3.8
// any[ residencyState=CA (hard, FAIL), gpaAtLeast 3.0 (hard, PASS) ]
//   One branch passes → student is eligible.
//   The CA residency failure must NOT appear in whyNotPerfect.
// ---------------------------------------------------------------------------

describe("Criterion I — any node with one passing branch, no misleading whyNotPerfect", () => {
  it("any[hard CA residency fail, hard GPA pass] → eligible", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        { kind: "residencyState", state: "CA", weight: "hard" },
        { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
      ],
    });
    // Student is NE (CA residency fails) but GPA 3.8 ≥ 3.0 (passes).
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });

  it("failing branch leaves do NOT appear in whyNotPerfect", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        // Branch 1: CA residency — student is NE → fails
        { kind: "residencyState", state: "CA", weight: "hard" },
        // Branch 2: GPA 3.0 — student has 3.8 → passes
        { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
      ],
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
    // The CA residency failure must NOT appear as a gap in whyNotPerfect.
    const notPerfect = results[0].whyNotPerfect;
    expect(notPerfect.some((s) => s.includes("CA"))).toBe(false);
  });

  it("any with two hard-failing branches → excluded", () => {
    const aid = makeAid({
      kind: "any",
      rules: [
        // Branch 1: CA residency — student is NE → fails
        { kind: "residencyState", state: "CA", weight: "hard" },
        // Branch 2: GPA 4.0 — student has 3.8 → fails
        { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
      ],
    });
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// J — Nested: NOT(any[hard-fail, hard-fail]) → eligible
//
// NOT(any[CA residency, GPA ≥ 4.0]) where student is NE with GPA 3.8
//   any-node: CA fails, GPA 4.0 fails → any passes? No → any evaluates to false
//   NOT(false) = true → student is eligible
// ---------------------------------------------------------------------------

describe("Criterion J — Nested: NOT(any[fail, fail]) is eligible", () => {
  it("NOT(any[CA residency fail, GPA≥4.0 fail]) → eligible", () => {
    const aid = makeAid({
      kind: "not",
      rule: {
        kind: "any",
        rules: [
          { kind: "residencyState", state: "CA", weight: "hard" },
          { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
        ],
      },
    });
    // Student is NE (CA fails) and GPA 3.8 < 4.0 (fails).
    // Inner any evaluates to false → NOT(false) = true → eligible.
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// K — Nested: NOT(any[hard-pass, hard-fail]) → excluded
//
// NOT(any[NE residency (PASS), GPA ≥ 4.0 (FAIL)]) where student is NE
//   any-node: NE passes → any evaluates to true
//   NOT(true) = false → student is excluded
// ---------------------------------------------------------------------------

describe("Criterion K — Nested: NOT(any[pass, fail]) is excluded", () => {
  it("NOT(any[NE residency pass, GPA≥4.0 fail]) → excluded", () => {
    const aid = makeAid({
      kind: "not",
      rule: {
        kind: "any",
        rules: [
          { kind: "residencyState", state: "NE", weight: "hard" },
          { kind: "gpaAtLeast", value: 4.0, weight: "hard" },
        ],
      },
    });
    // Student is NE (NE residency passes) even though GPA 4.0 fails.
    // Inner any evaluates to true (at least one branch passes) → NOT(true) = false → excluded.
    const results = matchProfile(BASE_PROFILE, [aid]);
    expect(results).toHaveLength(0);
  });
});
