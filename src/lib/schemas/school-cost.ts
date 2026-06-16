/**
 * SchoolCost — Zod schemas + inferred TypeScript types.
 *
 * Powers criterion C: comparing in-state vs out-of-state school cost / net price
 * by family income band. Used by POST /api/schools.
 *
 * Income-band keys deliberately match StudentProfile.householdIncomeBand so
 * callers can join the two without any key translation.
 */

import { z } from "zod";
import { IncomeBandSchema } from "./student-profile";

// ---------------------------------------------------------------------------
// NetPriceByIncome — keyed by IncomeBand
// ---------------------------------------------------------------------------

export const NetPriceByIncomeSchema = z.object({
  "0-30k": z.number().nonnegative().optional(),
  "30-48k": z.number().nonnegative().optional(),
  "48-75k": z.number().nonnegative().optional(),
  "75-110k": z.number().nonnegative().optional(),
  "110k+": z.number().nonnegative().optional(),
});
export type NetPriceByIncome = z.infer<typeof NetPriceByIncomeSchema>;

// ---------------------------------------------------------------------------
// SchoolCost — one institution's cost snapshot
// ---------------------------------------------------------------------------

export const SchoolCostSchema = z.object({
  /** College Scorecard institution unit ID (UNITID), e.g. "181464" */
  id: z.string(),
  name: z.string(),
  city: z.string(),
  /** 2-letter US state code */
  state: z.string().length(2),
  control: z.enum(["public", "private"]),
  /** In-state tuition & fees (omitted if unavailable or not applicable) */
  tuitionInState: z.number().nonnegative().optional(),
  /** Out-of-state tuition & fees */
  tuitionOutOfState: z.number().nonnegative().optional(),
  /**
   * Average annual net price (tuition + room/board + books - grants/scholarships)
   * broken out by family income band. Source is IPEDS/Scorecard NPT4x variables.
   * For public institutions this uses the public-institution cohort; for private
   * institutions it uses the private cohort.
   */
  netPriceByIncome: NetPriceByIncomeSchema,
  /** Majors offered (free-text tags; may be empty) */
  majors: z.array(z.string()).optional(),
  source: z.object({
    sourceName: z.string(),
    sourceUrl: z.string().url(),
    /** ISO date when this record was last verified, e.g. "2026-06-16" */
    lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  }),
  /** Whether the data came from the live Scorecard API or the local cache */
  dataSource: z.enum(["live", "cached"]),
});

export type SchoolCost = z.infer<typeof SchoolCostSchema>;

// ---------------------------------------------------------------------------
// SchoolsRequest — POST /api/schools request body
// ---------------------------------------------------------------------------

export const SchoolsRequestSchema = z.object({
  /** 2-letter US state code — filters schools whose primary state is this */
  state: z.string().length(2),
  /** If provided, filter netPriceByIncome display to this band */
  incomeBand: IncomeBandSchema.optional(),
  /** If provided, prefer schools offering these majors (advisory filter) */
  majors: z.array(z.string()).optional(),
  /**
   * When true, also include out-of-state schools relevant to a student
   * in the requested state. Defaults to false.
   */
  includeOutOfState: z.boolean().optional(),
});

export type SchoolsRequest = z.infer<typeof SchoolsRequestSchema>;

// ---------------------------------------------------------------------------
// SchoolsResponse — POST /api/schools response body
// ---------------------------------------------------------------------------

export const SchoolsResponseSchema = z.object({
  schools: z.array(SchoolCostSchema),
  meta: z.object({
    dataSource: z.enum(["live", "cached"]),
    /** ISO datetime when this response was generated */
    generatedAt: z.string().datetime(),
  }),
});

export type SchoolsResponse = z.infer<typeof SchoolsResponseSchema>;
