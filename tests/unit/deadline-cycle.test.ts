/**
 * Cycle-aware deadline tests (Fix 3 — application-cycle deadline handling).
 *
 * The engine previously flagged scholarship deadlines as "passed this year"
 * based only on the current calendar date, even for underclassmen (e.g., a
 * rising junior with gradYear 2028) who won't apply until their senior year.
 *
 * Fix:
 *   - Students are "in-cycle" when currentYear >= gradYear - 1.
 *   - For in-cycle students: existing urgency/passed behavior is unchanged.
 *   - For out-of-cycle (underclassman): a past dated deadline is NOT marked
 *     "passed"; instead an informational annual-recurrence note is shown.
 *     No feasibility penalty is applied for the passed deadline.
 *
 * All tests use an injectable `asOf` date so they are clock-independent.
 * The fixed "today" used here is 2026-06-17 (the date this bug was fixed).
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

/** Fixed clock: the date this fix was implemented. */
const AS_OF = new Date("2026-06-17");

/**
 * A past-2026 dated deadline — this date is before AS_OF so it "looks passed"
 * under the old logic.  Annual scholarships repeat every year so an underclassman
 * should NOT be penalised for it.
 */
const PAST_2026_DEADLINE = "2026-02-14"; // Davidson Fellows date in seed

function makeAid(
  eligibility: EligibilityRuleSet,
  overrides: Partial<AidRecord> = {}
): AidRecord {
  return {
    id: "deadline-cycle-test",
    name: "Deadline Cycle Test Aid",
    provider: "Test Foundation",
    type: "scholarship",
    selectivity: "open",
    award: { amountMin: 5000, amountMax: 5000, renewable: false },
    deadline: { type: "date", date: PAST_2026_DEADLINE },
    sourceUrl: "https://example.com/scholarship",
    sourceName: "Example Foundation",
    lastVerifiedAt: "2026-01-01",
    scope: { level: "national" },
    tags: {},
    eligibility,
    ...overrides,
  };
}

/**
 * A simple open award (no income gate, no residency) with a passed 2026 date
 * deadline.  A qualified rising junior should reach "strong" for this.
 */
const SIMPLE_ELIGIBLE_AID: EligibilityRuleSet = {
  kind: "all",
  rules: [
    { kind: "citizenshipIn", values: ["us_citizen", "permanent_resident"], weight: "hard" },
    { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
  ],
};

/** Rising junior profile — gradYear 2028, clearly eligible for the simple award. */
const RISING_JUNIOR_2028: StudentProfile = {
  gradeLevel: "junior",
  gradYear: 2028,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.6,
  gpaScale: 4.0,
  testScores: {},
  intendedMajors: ["Biology"],
  householdIncomeBand: "30-48k",
  activities: ["volunteering"],
};

/** Senior profile in the 2026-27 applying cycle — gradYear 2027. */
const SENIOR_2027: StudentProfile = {
  gradeLevel: "senior",
  gradYear: 2027,
  homeState: "NE",
  citizenship: "us_citizen",
  gpa: 3.6,
  gpaScale: 4.0,
  testScores: {},
  intendedMajors: ["Biology"],
  householdIncomeBand: "30-48k",
  activities: ["volunteering"],
};

// ---------------------------------------------------------------------------
// Cycle derivation
// ---------------------------------------------------------------------------

describe("Cycle-aware deadline — rising junior (gradYear 2028)", () => {
  it("is NOT considered in-cycle when asOf=2026-06-17 (gradYear-1 is 2027)", () => {
    // The engine derives isInCycle = currentYear >= gradYear - 1.
    // For gradYear 2028: gradYear - 1 = 2027; currentYear 2026 < 2027 → NOT in-cycle.
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(RISING_JUNIOR_2028, [aid], AS_OF);
    // Award must still be present (deadline does not hard-block underclassman).
    expect(results).toHaveLength(1);
  });

  it("past 2026 deadline is NOT marked 'passed' in whyNotPerfect for underclassman", () => {
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(RISING_JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const notPerfect = results[0].whyNotPerfect;
    const hasPassed = notPerfect.some((s) => /passed/i.test(s));
    expect(hasPassed, "should NOT contain 'passed' for an underclassman").toBe(false);
  });

  it("shows a recurring-cycle note mentioning the application year (gradYear - 1)", () => {
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(RISING_JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const notPerfect = results[0].whyNotPerfect;
    // Expect a note referencing the student's application year (2027 = 2028 - 1).
    const hasRecurringNote = notPerfect.some(
      (s) => /annual/i.test(s) && /2027/.test(s)
    );
    expect(
      hasRecurringNote,
      `Expected a recurring-cycle note with 2027; got: ${JSON.stringify(notPerfect)}`
    ).toBe(true);
  });

  it("a qualified rising junior gets 'strong' for a clearly-eligible open recurring award", () => {
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(RISING_JUNIOR_2028, [aid], AS_OF);
    expect(results).toHaveLength(1);
    expect(results[0].band).toBe("strong");
  });

  it("score is the same with and without a past deadline (no deadline drag for underclassman)", () => {
    const aidWithDate = makeAid(SIMPLE_ELIGIBLE_AID); // past deadline
    const aidRolling = makeAid(SIMPLE_ELIGIBLE_AID, {
      id: "deadline-cycle-rolling",
      deadline: { type: "rolling" },
    });
    const [withDate] = matchProfile(RISING_JUNIOR_2028, [aidWithDate], AS_OF);
    const [rolling] = matchProfile(RISING_JUNIOR_2028, [aidRolling], AS_OF);
    expect(withDate.feasibilityScore).toBe(rolling.feasibilityScore);
  });

  it("deadlineAfter leaf is treated as met for underclassman (no hard-block)", () => {
    // Construct an award with an explicit deadlineAfter hard leaf for a past date.
    const aidWithDeadlineAfter = makeAid({
      kind: "all",
      rules: [
        { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
        // This is a past date — would hard-block an in-cycle student.
        { kind: "deadlineAfter", date: PAST_2026_DEADLINE, weight: "hard" },
      ],
    });
    const results = matchProfile(RISING_JUNIOR_2028, [aidWithDeadlineAfter], AS_OF);
    // For the underclassman, the passed deadlineAfter should NOT hard-block.
    expect(results).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Senior (gradYear 2027) in 2026-27 cycle — unchanged behavior
// ---------------------------------------------------------------------------

describe("Cycle-aware deadline — senior (gradYear 2027, in-cycle in 2026)", () => {
  it("IS considered in-cycle when asOf=2026-06-17 (gradYear-1 is 2026)", () => {
    // currentYear 2026 >= gradYear - 1 (2026) → in-cycle.
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(1);
  });

  it("past 2026 deadline surfaces 'passed' in whyNotPerfect for a senior", () => {
    const aid = makeAid(SIMPLE_ELIGIBLE_AID);
    const results = matchProfile(SENIOR_2027, [aid], AS_OF);
    expect(results).toHaveLength(1);
    const notPerfect = results[0].whyNotPerfect;
    const hasPassed = notPerfect.some((s) => /passed/i.test(s));
    expect(hasPassed, "senior should see 'passed' warning for a past deadline").toBe(true);
  });

  it("deadlineAfter hard leaf with past date hard-blocks a senior", () => {
    const aidWithDeadlineAfter = makeAid({
      kind: "all",
      rules: [
        { kind: "gpaAtLeast", value: 3.0, weight: "hard" },
        { kind: "deadlineAfter", date: PAST_2026_DEADLINE, weight: "hard" },
      ],
    });
    const results = matchProfile(SENIOR_2027, [aidWithDeadlineAfter], AS_OF);
    // For the in-cycle senior, a past deadlineAfter leaf hard-blocks the award.
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Seed data integration — rising junior gradYear 2028
// ---------------------------------------------------------------------------

describe("Cycle-aware deadline — seed data integration (gradYear 2028)", () => {
  function getRecords(): AidRecord[] {
    return seedData.map((r) => AidRecordSchema.parse(r));
  }

  /**
   * NE rising junior, gradYear 2028, clearly eligible for need/residency awards.
   * With the fix, awards with past 2026 deadlines must NOT suppress "strong" band.
   */
  const JUNIOR_2028_NE: StudentProfile = {
    gradeLevel: "junior",
    gradYear: 2028,
    homeState: "NE",
    citizenship: "us_citizen",
    gpa: 3.5,
    gpaScale: 4.0,
    testScores: {},
    intendedMajors: ["Biology"],
    householdIncomeBand: "30-48k",
    activities: ["tennis", "volunteering"],
  };

  it("has at least 1 strong match for a qualified NE rising junior (gradYear 2028)", () => {
    const records = getRecords();
    const results = matchProfile(JUNIOR_2028_NE, records, AS_OF);
    const strongCount = results.filter((r) => r.band === "strong").length;
    expect(
      strongCount,
      `Expected >= 1 strong match for NE junior; found ${strongCount}. ` +
        `All bands: ${results.map((r) => r.band + ":" + r.aid.id).join(", ")}`
    ).toBeGreaterThanOrEqual(1);
  });

  it("Nebraska Opportunity Grant is strong for NE junior (gradYear 2028)", () => {
    const records = getRecords();
    const results = matchProfile(JUNIOR_2028_NE, records, AS_OF);
    const nog = results.find((r) => r.aid.id === "nebraska-opportunity-grant-2026");
    expect(nog, "Nebraska Opportunity Grant should appear for NE junior").toBeDefined();
    expect(nog!.band).toBe("strong");
  });

  it("Nebraska Opportunity Grant does not have 'passed' in whyNotPerfect for NE junior (gradYear 2028)", () => {
    const records = getRecords();
    const results = matchProfile(JUNIOR_2028_NE, records, AS_OF);
    const nog = results.find((r) => r.aid.id === "nebraska-opportunity-grant-2026");
    expect(nog).toBeDefined();
    const hasPassed = nog!.whyNotPerfect.some((s) => /passed/i.test(s));
    expect(hasPassed, "NOG should not say 'passed' for an underclassman").toBe(false);
  });
});
