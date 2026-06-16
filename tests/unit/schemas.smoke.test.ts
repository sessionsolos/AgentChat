/**
 * Smoke tests for the Zod schemas (WS-0).
 *
 * Verifies that:
 * - Valid data parses successfully
 * - Invalid data is rejected with a ZodError
 * - The seed record validates against AidRecordSchema
 * - matchProfile stub returns []
 */

import { describe, it, expect } from "vitest";
import {
  StudentProfileSchema,
  AidRecordSchema,
  MatchResultSchema,
  MatchRequestSchema,
} from "@/lib/schemas";
import { matchProfile } from "@/lib/engine";
import seedData from "@/data/scholarships.seed.json";

// ---------------------------------------------------------------------------
// StudentProfile
// ---------------------------------------------------------------------------

describe("StudentProfileSchema", () => {
  const validProfile = {
    gradeLevel: "senior",
    gradYear: 2026,
    homeState: "CA",
    citizenship: "us_citizen",
    gpa: 3.8,
    gpaScale: 4.0,
    testScores: { sat: 1420, act: 32 },
    intendedMajors: ["Computer Science"],
    householdIncomeBand: "48-75k",
    activities: ["nhs", "athletics:tennis"],
  } as const;

  it("parses a valid profile", () => {
    const result = StudentProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("defaults gpaScale to 4.0 when omitted", () => {
    const { gpaScale: _omitted, ...withoutScale } = validProfile;
    const result = StudentProfileSchema.safeParse(withoutScale);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gpaScale).toBe(4.0);
    }
  });

  it("rejects GPA over 4.0", () => {
    const result = StudentProfileSchema.safeParse({ ...validProfile, gpa: 5.0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid state code", () => {
    const result = StudentProfileSchema.safeParse({ ...validProfile, homeState: "XX" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gradeLevel", () => {
    const result = StudentProfileSchema.safeParse({ ...validProfile, gradeLevel: "freshman" });
    expect(result.success).toBe(false);
  });

  it("rejects SAT score out of range", () => {
    const result = StudentProfileSchema.safeParse({
      ...validProfile,
      testScores: { sat: 200 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AidRecord
// ---------------------------------------------------------------------------

describe("AidRecordSchema — seed data", () => {
  it("seed file contains at least one record", () => {
    expect(seedData.length).toBeGreaterThan(0);
  });

  it("every seed record validates against AidRecordSchema", () => {
    for (const record of seedData) {
      const result = AidRecordSchema.safeParse(record);
      if (!result.success) {
        // Surface the exact validation error in the test output
        throw new Error(
          `Seed record id="${(record as { id?: string }).id}" failed validation:\n` +
            JSON.stringify(result.error.format(), null, 2)
        );
      }
      expect(result.success).toBe(true);
    }
  });

  it("seed record has required provenance fields", () => {
    const record = AidRecordSchema.parse(seedData[0]);
    expect(record.sourceUrl).toBeTruthy();
    expect(record.sourceName).toBeTruthy();
    expect(record.lastVerifiedAt).toBeTruthy();
    expect(record.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Engine stub
// ---------------------------------------------------------------------------

describe("matchProfile stub", () => {
  it("returns an empty array", () => {
    const profile = StudentProfileSchema.parse({
      gradeLevel: "junior",
      gradYear: 2027,
      homeState: "TX",
      citizenship: "us_citizen",
      gpa: 3.5,
      testScores: {},
      intendedMajors: ["Nursing"],
      householdIncomeBand: "30-48k",
      activities: [],
    });

    const results = matchProfile(profile, []);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MatchRequest schema (API contract)
// ---------------------------------------------------------------------------

describe("MatchRequestSchema", () => {
  it("parses a valid match request body", () => {
    const body = {
      profile: {
        gradeLevel: "senior",
        gradYear: 2026,
        homeState: "NY",
        citizenship: "us_citizen",
        gpa: 3.9,
        testScores: { sat: 1500 },
        intendedMajors: ["Engineering"],
        householdIncomeBand: "0-30k",
        activities: ["volunteering"],
      },
    };
    const result = MatchRequestSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it("rejects a request body missing the profile key", () => {
    const result = MatchRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
