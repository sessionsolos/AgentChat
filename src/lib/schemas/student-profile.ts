/**
 * StudentProfile — Zod schema + inferred TypeScript type.
 *
 * This is the single source of truth for the student input shape.
 * The Prisma model in prisma/schema.prisma mirrors these fields.
 * The POST /api/match route validates request bodies against this schema.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Constituent enums and sub-schemas
// ---------------------------------------------------------------------------

export const GradeLevelSchema = z.enum(["sophomore", "junior", "senior"]);
export type GradeLevel = z.infer<typeof GradeLevelSchema>;

/** All 50 states + DC */
export const USStateSchema = z.enum([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);
export type USState = z.infer<typeof USStateSchema>;

export const CitizenshipSchema = z.enum([
  "us_citizen",
  "permanent_resident",
  "daca",
  "international",
  "other",
]);
export type Citizenship = z.infer<typeof CitizenshipSchema>;

/**
 * Income bands aligned to College Scorecard net-price bands.
 * "110k+" covers households above $110,000.
 */
export const IncomeBandSchema = z.enum([
  "0-30k",
  "30-48k",
  "48-75k",
  "75-110k",
  "110k+",
]);
export type IncomeBand = z.infer<typeof IncomeBandSchema>;

export const DependentStatusSchema = z.enum(["dependent", "independent"]);
export type DependentStatus = z.infer<typeof DependentStatusSchema>;

export const TestScoresSchema = z.object({
  /** SAT total score: 400–1600 */
  sat: z.number().int().min(400).max(1600).optional(),
  /** ACT composite score: 1–36 */
  act: z.number().int().min(1).max(36).optional(),
  /** PSAT/NMSQT score — range varies by year; store raw number */
  psat: z.number().optional(),
});
export type TestScores = z.infer<typeof TestScoresSchema>;

/**
 * Optional demographic fields.
 * Kept minimal and eligibility-relevant only (e.g., for need-based aid
 * targeted at specific groups). PII handling is out of scope for WS-0.
 */
export const DemographicsSchema = z.object({
  /** First-generation college student */
  firstGenCollegeStudent: z.boolean().optional(),
  /** Self-reported gender identity (free-text) — some scholarships target specific groups */
  genderIdentity: z.string().optional(),
  /** Racial/ethnic identity tags — some scholarships are targeted */
  ethnicityTags: z.array(z.string()).optional(),
  /** Military-affiliated (veteran, active duty, dependent) */
  militaryAffiliation: z
    .enum(["veteran", "active_duty", "dependent", "none"])
    .optional(),
});
export type Demographics = z.infer<typeof DemographicsSchema>;

// ---------------------------------------------------------------------------
// Top-level StudentProfile schema
// ---------------------------------------------------------------------------

export const StudentProfileSchema = z.object({
  gradeLevel: GradeLevelSchema,
  /** Expected graduation year, e.g. 2026 */
  gradYear: z.number().int().min(2020).max(2040),
  homeState: USStateSchema,
  citizenship: CitizenshipSchema,
  /** Unweighted GPA */
  gpa: z.number().min(0).max(4.0),
  /** The scale the GPA is reported on — defaults to 4.0 */
  gpaScale: z.number().positive().default(4.0),
  testScores: TestScoresSchema,
  /** Free-text major tags for MVP (e.g. "Computer Science", "Nursing") */
  intendedMajors: z.array(z.string()),
  /** College Scorecard institution unit IDs the student is targeting */
  targetSchoolIds: z.array(z.string()).optional(),
  householdIncomeBand: IncomeBandSchema,
  dependentStatus: DependentStatusSchema.optional(),
  householdSize: z.number().int().min(1).optional(),
  /**
   * Activity tags.
   * Format: plain tag (e.g. "nhs", "volunteering") or namespaced (e.g. "athletics:tennis").
   * WS-2 matches these against EligibilityRuleSet `hasActivity` leaf predicates.
   */
  activities: z.array(z.string()),
  demographics: DemographicsSchema.optional(),
});

export type StudentProfile = z.infer<typeof StudentProfileSchema>;
