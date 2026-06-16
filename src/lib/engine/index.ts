/**
 * Matching engine — stub implementation for WS-0.
 *
 * WS-2 (feasibility engine) owns this module. Replace the stub body with
 * the real scoring logic. The function signature and return type must not
 * change; the API route and tests depend on them.
 *
 * Algorithm sketch for WS-2:
 *   1. Pre-filter records where ALL hard-weight leaf predicates are met.
 *   2. Score remaining records by soft-weight predicates → feasibilityScore 0–100.
 *   3. Assign band: score ≥ 80 → "strong", ≥ 50 → "possible", else "reach".
 *   4. Populate whyEligible / whyNotPerfect from predicate evaluation.
 *   5. Return sorted descending by feasibilityScore.
 */

import type { AidRecord } from "@/lib/schemas/aid-record";
import type { MatchResult } from "@/lib/schemas/match-result";
import type { StudentProfile } from "@/lib/schemas/student-profile";

/**
 * Match a StudentProfile against a catalogue of AidRecords.
 *
 * @param profile  - Validated StudentProfile from the API request.
 * @param records  - AidRecord catalogue (loaded from DB or seed data).
 * @returns        - Ranked MatchResult array, sorted by feasibilityScore descending.
 *                   Returns [] until WS-2 implements the scoring logic.
 */
export function matchProfile(
  profile: StudentProfile,
  records: AidRecord[]
): MatchResult[] {
  // WS-2: implement scoring here.
  // Suppress unused-variable lint warnings until WS-2 fills this in.
  void profile;
  void records;
  return [];
}
