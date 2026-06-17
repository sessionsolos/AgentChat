/**
 * AidRecord — Zod schema + inferred TypeScript type.
 *
 * Represents a single scholarship, grant, or institutional aid program.
 * Every record MUST carry sourceUrl, sourceName, and lastVerifiedAt —
 * provenance is mandatory so the frontend can show citations and WS-2
 * can surface them in MatchResult.citation.
 *
 * Stored in the `aid_records` table; complex fields are JSON-serialized
 * (compatible with both SQLite and Postgres).
 */

import { z } from "zod";
import { USStateSchema } from "./student-profile";
import { EligibilityRuleSetSchema } from "./eligibility";

// ---------------------------------------------------------------------------
// Award
// ---------------------------------------------------------------------------

export const AwardSchema = z.object({
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
  /** Whether the award can be renewed in subsequent years */
  renewable: z.boolean(),
});
export type Award = z.infer<typeof AwardSchema>;

// ---------------------------------------------------------------------------
// Deadline — discriminated union
// ---------------------------------------------------------------------------

export const DeadlineSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("date"),
    /** ISO date string, e.g. "2025-11-01" */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  }),
  z.object({ type: z.literal("rolling") }),
  z.object({ type: z.literal("unknown") }),
]);
export type Deadline = z.infer<typeof DeadlineSchema>;

// ---------------------------------------------------------------------------
// Scope — where the scholarship applies
// ---------------------------------------------------------------------------

export const ScopeSchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("national") }),
  z.object({ level: z.literal("state"), state: USStateSchema }),
  z.object({
    level: z.literal("school"),
    /** College Scorecard unitid */
    scorecardId: z.string(),
  }),
]);
export type Scope = z.infer<typeof ScopeSchema>;

// ---------------------------------------------------------------------------
// Tags — major/activity tags for fast pre-filtering
// ---------------------------------------------------------------------------

export const TagsSchema = z.object({
  majors: z.array(z.string()).optional(),
  activities: z.array(z.string()).optional(),
});
export type Tags = z.infer<typeof TagsSchema>;

// ---------------------------------------------------------------------------
// AidType
// ---------------------------------------------------------------------------

export const AidTypeSchema = z.enum([
  "scholarship",
  "grant",
  "institutional_aid",
]);
export type AidType = z.infer<typeof AidTypeSchema>;

// ---------------------------------------------------------------------------
// Selectivity — how competitive an award is nationally
// ---------------------------------------------------------------------------

/**
 * Selectivity tier for an award.
 *
 *   highly_selective — nationally competitive, elite awards (Davidson Fellows,
 *                       Mensa, National Merit, Regeneron STS, Coca-Cola, Jack
 *                       Kent Cooke, QuestBridge, Ron Brown, Equitable Excellence,
 *                       Elks MVS, Dell).  A typical solid applicant should land
 *                       at most "possible", not "strong".
 *   competitive      — meaningful selection process but broader eligibility
 *                       (Horatio Alger, NHS, SWE, DoD SMART, TEACH, TYLENOL,
 *                       USTA Foundation, FFA, Burger King, ACS Scholars, DAR, etc.)
 *   open             — need-/residency-based programs where meeting hard criteria
 *                       means you are awarded; no competitive ranking
 *                       (Federal Pell Grant, Nebraska Opportunity Grant, Nebraska
 *                        Promise, ACE, Nebraska Career Scholarship, Susan Buffett,
 *                        Scholastic Art & Writing, Nebraska Farm Bureau).
 *
 * Defaults to "competitive" when absent (schema uses .default()).
 */
export const SelectivitySchema = z.enum([
  "open",
  "competitive",
  "highly_selective",
]);
export type Selectivity = z.infer<typeof SelectivitySchema>;

// ---------------------------------------------------------------------------
// Citation — embedded in MatchResult; derived from provenance fields
// ---------------------------------------------------------------------------

export const CitationSchema = z.object({
  sourceName: z.string(),
  sourceUrl: z.string().url(),
  /** ISO date string, e.g. "2025-01-15" */
  lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
});
export type Citation = z.infer<typeof CitationSchema>;

// ---------------------------------------------------------------------------
// AidRecord — top-level schema
// ---------------------------------------------------------------------------

export const AidRecordSchema = z.object({
  /** Stable identifier — cuid or College Scorecard-derived ID */
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  type: AidTypeSchema,

  award: AwardSchema,
  deadline: DeadlineSchema,
  applyUrl: z.string().url().optional(),

  /**
   * Provenance — REQUIRED on every record.
   * WS-1 must populate these when ingesting data from Scorecard or other sources.
   */
  sourceUrl: z.string().url(),
  sourceName: z.string(),
  /** ISO date when this record was last verified accurate, e.g. "2025-01-15" */
  lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),

  scope: ScopeSchema,
  tags: TagsSchema,
  eligibility: EligibilityRuleSetSchema,

  /**
   * Selectivity tier — how competitive this award is.
   * Defaults to "competitive" when omitted from source data.
   * Used by the engine to cap feasibility bands for elite awards.
   */
  selectivity: SelectivitySchema.default("competitive"),
});

export type AidRecord = z.infer<typeof AidRecordSchema>;
