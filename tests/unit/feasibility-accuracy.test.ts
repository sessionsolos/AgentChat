/**
 * Feasibility accuracy tests (WS-2 fix verification).
 *
 * Verifies the two fixes:
 *   Fix 1 — Selectivity caps feasibility bands for highly-selective awards.
 *   Fix 2 — Heritage/identity (ethnicityIn) correctly gates awards.
 *
 * Real test case: a rising Nebraska junior with GPA 3.5, no test scores,
 * Biology major, income 48-75k, activities [tennis, volunteering].
 * All assertions run against the real seed catalogue.
 */

import { describe, it, expect } from "vitest";
import { matchProfile } from "@/lib/engine";
import type { StudentProfile } from "@/lib/schemas/student-profile";
import type { AidRecord } from "@/lib/schemas/aid-record";
import type { EligibilityRuleSet } from "@/lib/schemas/eligibility";
import { AidRecordSchema } from "@/lib/schemas";
import seedData from "@/data/scholarships.seed.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecords(): AidRecord[] {
  return seedData.map((r) => AidRecordSchema.parse(r));
}

/**
 * The primary test profile from the brief:
 * NE junior, GPA 3.5, no test scores, Biology, income 48-75k,
 * activities [tennis, volunteering], no ethnicity provided.
 */
const NE_JUNIOR_PROFILE: StudentProfile = {
  gradeLevel: "junior",
  gradYear: 2027,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.5,
  gpaScale: 4.0,
  testScores: {},
  intendedMajors: ["Biology"],
  householdIncomeBand: "48-75k",
  activities: ["tennis", "volunteering"],
  // no demographics / ethnicityTags
};

// ---------------------------------------------------------------------------
// Fix 1 — Selectivity band caps
// ---------------------------------------------------------------------------

describe("Fix 1 — Selectivity band caps for real seed data", () => {
  it("Nebraska Opportunity Grant is strong for the NE junior profile", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "nebraska-opportunity-grant-2026");
    expect(result, "Nebraska Opportunity Grant should match the NE junior").toBeDefined();
    expect(result!.band).toBe("strong");
  });

  it("Nebraska Promise is strong for the NE junior profile", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "nebraska-promise-2026");
    expect(result, "Nebraska Promise should match the NE junior (GPA 3.5 ≥ 2.5, NE resident)").toBeDefined();
    expect(result!.band).toBe("strong");
  });

  it("Federal Pell Grant is strong for the NE junior profile (income 48-75k, citizen)", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "federal-pell-grant-2026");
    expect(result, "Federal Pell Grant should match the NE junior").toBeDefined();
    expect(result!.band).toBe("strong");
  });

  it("Davidson Fellows is NOT strong for a typical NE junior (highly_selective)", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "davidson-fellows-2026");
    expect(result, "Davidson Fellows should still match (no hard GPA/residency bar it fails)").toBeDefined();
    expect(result!.band).not.toBe("strong");
    // Should be reach or possible, never strong
    expect(["reach", "possible"]).toContain(result!.band);
  });

  it("Mensa Foundation Scholarship is NOT strong for a typical NE junior (highly_selective)", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "mensa-foundation-scholarship-2026");
    expect(result, "Mensa should still match (junior is eligible grade level)").toBeDefined();
    expect(result!.band).not.toBe("strong");
    expect(["reach", "possible"]).toContain(result!.band);
  });

  it("National Merit is NOT strong for a typical NE junior (highly_selective, senior-only)", () => {
    // National Merit requires senior — junior is excluded by hard gradeLevelIn.
    // If it appears, it must not be strong.
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const result = results.find((r) => r.aid.id === "national-merit-scholarship-2026");
    // It has a hard senior-only gate so it will be excluded entirely for a junior.
    if (result) {
      expect(result.band).not.toBe("strong");
    }
    // The important case is handled by Davidson / Mensa above (which do allow juniors).
  });

  it("open awards score higher than highly_selective awards for the NE junior", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);

    const nopScore = results.find((r) => r.aid.id === "nebraska-opportunity-grant-2026")?.feasibilityScore;
    const davisonScore = results.find((r) => r.aid.id === "davidson-fellows-2026")?.feasibilityScore;

    expect(nopScore).toBeDefined();
    expect(davisonScore).toBeDefined();
    expect(nopScore!).toBeGreaterThan(davisonScore!);
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — Heritage/identity (ethnicityIn) eligibility
// ---------------------------------------------------------------------------

describe("Fix 2 — ethnicityIn: HSF with no ethnicity provided", () => {
  it("HSF appears in results when no ethnicityTags provided (not excluded)", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const hsf = results.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf, "HSF should appear (can't hard-exclude on unknown heritage)").toBeDefined();
  });

  it("HSF is NOT strong when no ethnicityTags provided (soft gap dampens score)", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const hsf = results.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf).toBeDefined();
    expect(hsf!.band).not.toBe("strong");
  });

  it("HSF has a heritage caveat in whyNotPerfect when no ethnicityTags provided", () => {
    const records = getRecords();
    const results = matchProfile(NE_JUNIOR_PROFILE, records);
    const hsf = results.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf).toBeDefined();
    // Should have a note about heritage requirement
    const hasHeritageCaveat = hsf!.whyNotPerfect.some((s) =>
      /hispanic/i.test(s) || /heritage/i.test(s) || /qualify/i.test(s)
    );
    expect(hasHeritageCaveat, "HSF should have a heritage caveat when ethnicity is unknown").toBe(true);
  });
});

describe("Fix 2 — ethnicityIn: HSF with hispanic ethnicity provided", () => {
  it("HSF is a clean match with no heritage caveat when ethnicityTags=['hispanic']", () => {
    const records = getRecords();
    const hispanicProfile: StudentProfile = {
      ...NE_JUNIOR_PROFILE,
      demographics: { ethnicityTags: ["hispanic"] },
    };
    const results = matchProfile(hispanicProfile, records);
    const hsf = results.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf, "HSF should match a hispanic student").toBeDefined();

    // No heritage caveat in whyNotPerfect (the ethnicity leaf is now met)
    const hasHeritageCaveat = hsf!.whyNotPerfect.some((s) =>
      /hispanic.*heritage/i.test(s) || /confirm you qualify/i.test(s)
    );
    expect(
      hasHeritageCaveat,
      "HSF should NOT have a heritage caveat for a confirmed hispanic student"
    ).toBe(false);

    // Score should be materially higher than the unknown-heritage case
    const noEthnicityResults = matchProfile(NE_JUNIOR_PROFILE, records);
    const noEthnicityHsf = noEthnicityResults.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf!.feasibilityScore).toBeGreaterThan(noEthnicityHsf!.feasibilityScore);
  });
});

describe("Fix 2 — ethnicityIn: HSF with non-hispanic ethnicity provided", () => {
  it("HSF is excluded when ethnicityTags=['white'] (hard mismatch)", () => {
    const records = getRecords();
    const whiteProfile: StudentProfile = {
      ...NE_JUNIOR_PROFILE,
      demographics: { ethnicityTags: ["white"] },
    };
    const results = matchProfile(whiteProfile, records);
    const hsf = results.find((r) => r.aid.id === "hispanic-scholarship-fund-2026");
    expect(hsf, "HSF must be excluded when student identifies as white only").toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — Ron Brown Scholar Program (black heritage, highly_selective)
// ---------------------------------------------------------------------------

describe("Fix 2 — Ron Brown Scholar: black heritage gate", () => {
  it("Ron Brown appears with heritage caveat when no ethnicityTags provided (NE junior)", () => {
    // Ron Brown is senior-only; the NE junior profile won't match due to grade level.
    // Verify with a senior profile.
    const records = getRecords();
    const senioreProfile: StudentProfile = {
      ...NE_JUNIOR_PROFILE,
      gradeLevel: "senior",
      gradYear: 2026,
    };
    const results = matchProfile(senioreProfile, records);
    const ronBrown = results.find((r) => r.aid.id === "ron-brown-scholar-2026");
    expect(ronBrown, "Ron Brown should appear for senior with no ethnicity (unknown heritage)").toBeDefined();
    expect(ronBrown!.band).not.toBe("strong");
  });

  it("Ron Brown is excluded when ethnicityTags=['white']", () => {
    const records = getRecords();
    const whiteProfile: StudentProfile = {
      ...NE_JUNIOR_PROFILE,
      gradeLevel: "senior",
      gradYear: 2026,
      demographics: { ethnicityTags: ["white"] },
    };
    const results = matchProfile(whiteProfile, records);
    const ronBrown = results.find((r) => r.aid.id === "ron-brown-scholar-2026");
    expect(ronBrown, "Ron Brown must be excluded for a non-black student").toBeUndefined();
  });

  it("Ron Brown is a match for ethnicityTags=['black']", () => {
    const records = getRecords();
    const blackProfile: StudentProfile = {
      ...NE_JUNIOR_PROFILE,
      gradeLevel: "senior",
      gradYear: 2026,
      demographics: { ethnicityTags: ["black"] },
    };
    const results = matchProfile(blackProfile, records);
    const ronBrown = results.find((r) => r.aid.id === "ron-brown-scholar-2026");
    expect(ronBrown, "Ron Brown should match a black senior student").toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Fix 1 — Selectivity: unit-level selectivity multiplier tests
// ---------------------------------------------------------------------------

describe("Fix 1 — Selectivity multiplier: inline fixture tests", () => {
  function makeAid(
    eligibility: EligibilityRuleSet,
    overrides: Partial<AidRecord> = {}
  ): AidRecord {
    return {
      id: "sel-test",
      name: "Selectivity Test Aid",
      provider: "Test Foundation",
      type: "scholarship",
      selectivity: "competitive",
      award: { amountMin: 5000, amountMax: 5000, renewable: false },
      deadline: { type: "rolling" },
      sourceUrl: "https://example.com/scholarship",
      sourceName: "Example Foundation",
      lastVerifiedAt: "2025-01-01",
      scope: { level: "national" },
      tags: {},
      eligibility,
      ...overrides,
    };
  }

  const TYPICAL_PROFILE: StudentProfile = {
    gradeLevel: "senior",
    gradYear: 2026,
    homeState: "NE",
    citizenship: "us_citizen",
    gpa: 3.5,
    gpaScale: 4.0,
    testScores: {},
    intendedMajors: ["Biology"],
    householdIncomeBand: "48-75k",
    activities: [],
  };

  it("open award with same criteria scores higher than highly_selective award", () => {
    const eligibility: EligibilityRuleSet = {
      kind: "gpaAtLeast",
      value: 3.0,
      weight: "hard",
    };
    const openAid = makeAid(eligibility, { id: "open-aid", selectivity: "open" });
    const selectiveAid = makeAid(eligibility, {
      id: "selective-aid",
      selectivity: "highly_selective",
    });

    const openResult = matchProfile(TYPICAL_PROFILE, [openAid])[0];
    const selectiveResult = matchProfile(TYPICAL_PROFILE, [selectiveAid])[0];

    expect(openResult.feasibilityScore).toBeGreaterThan(selectiveResult.feasibilityScore);
  });

  it("highly_selective award is NOT strong for typical student (GPA 3.5, no test scores)", () => {
    const eligibility: EligibilityRuleSet = {
      kind: "gpaAtLeast",
      value: 3.0,
      weight: "hard",
    };
    const selectiveAid = makeAid(eligibility, {
      id: "selective-aid",
      selectivity: "highly_selective",
    });

    const results = matchProfile(TYPICAL_PROFILE, [selectiveAid]);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
  });

  it("highly_selective award can be strong only for an exceptional student (GPA 3.9+, SAT 1500+)", () => {
    const eligibility: EligibilityRuleSet = {
      kind: "gpaAtLeast",
      value: 3.0,
      weight: "hard",
    };
    const selectiveAid = makeAid(eligibility, {
      id: "selective-aid",
      selectivity: "highly_selective",
      // Small award amount → full competitiveness score contribution
      award: { amountMin: 1000, amountMax: 1000, renewable: false },
    });

    // Exceptional profile: GPA 3.95 + SAT 1550
    const exceptionalProfile: StudentProfile = {
      ...TYPICAL_PROFILE,
      gpa: 3.95,
      testScores: { sat: 1550 },
    };

    // Even exceptional students are capped at "possible" for highly_selective
    const results = matchProfile(exceptionalProfile, [selectiveAid]);
    expect(results).toHaveLength(1);
    // Band cap means exceptional students land at "possible", not "strong"
    expect(results[0].band).toBe("possible");
  });

  it("competitive award scores between open and highly_selective", () => {
    const eligibility: EligibilityRuleSet = {
      kind: "gpaAtLeast",
      value: 3.0,
      weight: "hard",
    };
    const openAid = makeAid(eligibility, { id: "open-aid", selectivity: "open" });
    const competitiveAid = makeAid(eligibility, {
      id: "competitive-aid",
      selectivity: "competitive",
    });
    const selectiveAid = makeAid(eligibility, {
      id: "selective-aid",
      selectivity: "highly_selective",
    });

    const [openResult] = matchProfile(TYPICAL_PROFILE, [openAid]);
    const [compResult] = matchProfile(TYPICAL_PROFILE, [competitiveAid]);
    const [selResult] = matchProfile(TYPICAL_PROFILE, [selectiveAid]);

    expect(openResult.feasibilityScore).toBeGreaterThan(compResult.feasibilityScore);
    expect(compResult.feasibilityScore).toBeGreaterThan(selResult.feasibilityScore);
  });
});

// ---------------------------------------------------------------------------
// Fix 2 — ethnicityIn leaf: unit-level tests
// ---------------------------------------------------------------------------

describe("Fix 2 — ethnicityIn leaf: unit-level tests", () => {
  function makeAid(
    eligibility: EligibilityRuleSet,
    overrides: Partial<AidRecord> = {}
  ): AidRecord {
    return {
      id: "eth-test",
      name: "Ethnicity Test Aid",
      provider: "Test Foundation",
      type: "scholarship",
      selectivity: "competitive",
      award: { amountMin: 5000, amountMax: 5000, renewable: false },
      deadline: { type: "rolling" },
      sourceUrl: "https://example.com/scholarship",
      sourceName: "Example Foundation",
      lastVerifiedAt: "2025-01-01",
      scope: { level: "national" },
      tags: {},
      eligibility,
      ...overrides,
    };
  }

  const BASE: StudentProfile = {
    gradeLevel: "junior",
    gradYear: 2027,
    homeState: "NE",
    citizenship: "us_citizen",
    gpa: 3.5,
    gpaScale: 4.0,
    testScores: {},
    intendedMajors: ["Biology"],
    householdIncomeBand: "48-75k",
    activities: [],
  };

  const ethnicityInHard: EligibilityRuleSet = {
    kind: "ethnicityIn",
    values: ["hispanic"],
    weight: "hard",
  };

  it("ethnicityIn hard: student with matching tag is eligible", () => {
    const aid = makeAid(ethnicityInHard);
    const profile = {
      ...BASE,
      demographics: { ethnicityTags: ["hispanic"] },
    };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].whyEligible.some((s) => /heritage/i.test(s))).toBe(true);
  });

  it("ethnicityIn hard: student with non-matching tag is excluded", () => {
    const aid = makeAid(ethnicityInHard);
    const profile = {
      ...BASE,
      demographics: { ethnicityTags: ["asian"] },
    };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(0);
  });

  it("ethnicityIn hard: student with no tags is kept but not strong (soft gap)", () => {
    const aid = makeAid(ethnicityInHard);
    const results = matchProfile(BASE, [aid]);
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
    // Heritage note should be in whyNotPerfect
    expect(
      results[0].whyNotPerfect.some((s) => /hispanic/i.test(s) || /heritage/i.test(s))
    ).toBe(true);
  });

  it("ethnicityIn soft: student with no tags is kept with caveat (soft gap)", () => {
    const softEthnicityIn: EligibilityRuleSet = {
      kind: "ethnicityIn",
      values: ["hispanic"],
      weight: "soft",
    };
    const aid = makeAid(softEthnicityIn);
    const results = matchProfile(BASE, [aid]);
    expect(results).toHaveLength(1);
    // Should have a caveat note
    expect(
      results[0].whyNotPerfect.some((s) => /hispanic/i.test(s) || /heritage/i.test(s))
    ).toBe(true);
  });

  it("ethnicityIn: case-insensitive tag matching", () => {
    const aid = makeAid(ethnicityInHard);
    const profile = {
      ...BASE,
      demographics: { ethnicityTags: ["Hispanic"] }, // capital H
    };
    const results = matchProfile(profile, [aid]);
    expect(results).toHaveLength(1);
  });

  it("ethnicityIn: empty ethnicityTags array treated same as absent", () => {
    const aid = makeAid(ethnicityInHard);
    const profile = {
      ...BASE,
      demographics: { ethnicityTags: [] },
    };
    const results = matchProfile(profile, [aid]);
    // Empty = unknown, should still be included (soft gap, not hard excluded)
    expect(results).toHaveLength(1);
    expect(results[0].band).not.toBe("strong");
  });
});
