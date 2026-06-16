/**
 * MatchResult — Zod schema + inferred TypeScript type.
 *
 * The output shape of the matching engine (WS-2) and the /api/match response.
 * One MatchResult per AidRecord that the engine evaluated for the student.
 *
 * citation is derived from the AidRecord's provenance fields and surfaced
 * here so the frontend (WS-3) can render citations without re-fetching the
 * full AidRecord.
 */

import { z } from "zod";
import { AidRecordSchema, CitationSchema } from "./aid-record";
import { StudentProfileSchema } from "./student-profile";

// ---------------------------------------------------------------------------
// Feasibility band
// ---------------------------------------------------------------------------

export const FeasibilityBandSchema = z.enum(["strong", "possible", "reach"]);
export type FeasibilityBand = z.infer<typeof FeasibilityBandSchema>;

// ---------------------------------------------------------------------------
// MatchResult
// ---------------------------------------------------------------------------

export const MatchResultSchema = z.object({
  aid: AidRecordSchema,
  /**
   * 0–100 score produced by the feasibility engine.
   * Suggested thresholds: 80–100 → "strong", 50–79 → "possible", <50 → "reach"
   * (Exact thresholds are WS-2's decision; the band field is the canonical label.)
   */
  feasibilityScore: z.number().min(0).max(100),
  band: FeasibilityBandSchema,
  /** Human-readable reasons the student is a strong match */
  whyEligible: z.array(z.string()),
  /** Human-readable reasons they might not win / requirements they don't fully meet */
  whyNotPerfect: z.array(z.string()),
  /**
   * Citation derived from AidRecord.sourceUrl / sourceName / lastVerifiedAt.
   * Redundant with aid.source*, but makes the frontend's job trivial.
   */
  citation: CitationSchema,
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

// ---------------------------------------------------------------------------
// API response envelope — POST /api/match response body
// ---------------------------------------------------------------------------

export const MatchResponseSchema = z.object({
  results: z.array(MatchResultSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    /** ISO datetime when this response was generated, e.g. "2025-06-16T12:00:00.000Z" */
    generatedAt: z.string().datetime(),
  }),
});

export type MatchResponse = z.infer<typeof MatchResponseSchema>;

// ---------------------------------------------------------------------------
// API request body — POST /api/match request body
// ---------------------------------------------------------------------------

export const MatchRequestSchema = z.object({
  profile: StudentProfileSchema,
});

export type MatchRequest = z.infer<typeof MatchRequestSchema>;
