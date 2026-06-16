/**
 * Matching engine — WS-2 implementation.
 *
 * Public API: matchProfile(profile, records) → MatchResult[]
 *
 * Algorithm:
 *   1. Evaluate the EligibilityRuleSet for each AidRecord recursively.
 *   2. Hard-filter: exclude any record where an unmet leaf is both hard-weighted
 *      AND structurally required by the tree (e.g., an unmet hard leaf inside an
 *      `all` node, or a branch of an `any` where no sibling passed).
 *   3. Score survivors 0–100 (eligibility margin + soft-fit + competitiveness).
 *   4. Assign band: ≥80 → "strong", ≥50 → "possible", <50 → "reach".
 *   5. Build human-readable whyEligible / whyNotPerfect arrays.
 *   6. Return sorted descending by feasibilityScore.
 *
 * School-scoped awards (scope.level === "school") are handled gracefully:
 *   - If the student has targetSchoolIds, a school-scoped award matches only
 *     if the aid's scorecardId is in that list.
 *   - If targetSchoolIds is absent or empty, school-scoped awards are NOT
 *     excluded (we can't rule them out) — they receive a soft-penalty in
 *     whyNotPerfect noting that school cost data is pending.
 */

import type { AidRecord } from "@/lib/schemas/aid-record";
import type { MatchResult, FeasibilityBand } from "@/lib/schemas/match-result";
import type { StudentProfile } from "@/lib/schemas/student-profile";
import { evaluate, isObtainable } from "./evaluate";
import { computeScore } from "./score";
import { buildExplanations } from "./explain";
import {
  STRONG_THRESHOLD,
  POSSIBLE_THRESHOLD,
  HIGHLY_SELECTIVE_BAND_CAP,
  EXCEPTIONAL_GPA_FLOOR,
  EXCEPTIONAL_SAT_FLOOR,
  EXCEPTIONAL_ACT_FLOOR,
} from "./weights";

// ---------------------------------------------------------------------------
// matchProfile — the single exported entry point
// ---------------------------------------------------------------------------

/**
 * Match a StudentProfile against a catalogue of AidRecords.
 *
 * @param profile  - Validated StudentProfile from the API request.
 * @param records  - AidRecord catalogue (loaded from DB or seed data).
 * @returns        - Ranked MatchResult array, sorted by feasibilityScore descending.
 */
export function matchProfile(
  profile: StudentProfile,
  records: AidRecord[]
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const aid of records) {
    // -----------------------------------------------------------------------
    // Criterion C: school-scoped award guard
    // -----------------------------------------------------------------------
    const schoolNote = schoolScopeNote(profile, aid);
    // schoolNote === 'exclude' means we can definitively rule this out.
    if (schoolNote === "exclude") continue;

    // -----------------------------------------------------------------------
    // Step 1: recursive evaluation
    // -----------------------------------------------------------------------
    const leaves = evaluate(aid.eligibility, profile);

    // -----------------------------------------------------------------------
    // Step 2: hard filter
    // -----------------------------------------------------------------------
    if (!isObtainable(leaves)) continue;

    // -----------------------------------------------------------------------
    // Step 3: feasibility score
    // -----------------------------------------------------------------------
    const feasibilityScore = computeScore(leaves, profile, aid);

    // -----------------------------------------------------------------------
    // Step 4: band (with selectivity cap for highly_selective awards)
    // -----------------------------------------------------------------------
    const rawBand: FeasibilityBand = scoreToBand(feasibilityScore);
    const band: FeasibilityBand = applySelectivityCap(rawBand, aid, profile);

    // -----------------------------------------------------------------------
    // Step 5: explanations
    // -----------------------------------------------------------------------
    const { whyEligible, whyNotPerfect } = buildExplanations(leaves, aid);

    // Append school-scope note if the award is school-scoped and targetSchools
    // were not provided (so we couldn't confirm the match).
    if (typeof schoolNote === "string" && schoolNote.length > 0) {
      whyNotPerfect.push(schoolNote);
    }

    // -----------------------------------------------------------------------
    // Step 6: assemble MatchResult
    // -----------------------------------------------------------------------
    results.push({
      aid,
      feasibilityScore,
      band,
      whyEligible,
      whyNotPerfect,
      citation: {
        sourceName: aid.sourceName,
        sourceUrl: aid.sourceUrl,
        lastVerifiedAt: aid.lastVerifiedAt,
      },
    });
  }

  // Sort descending by feasibilityScore.
  results.sort((a, b) => b.feasibilityScore - a.feasibilityScore);

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToBand(score: number): FeasibilityBand {
  if (score >= STRONG_THRESHOLD) return "strong";
  if (score >= POSSIBLE_THRESHOLD) return "possible";
  return "reach";
}

/**
 * Handle school-scoped awards (Criterion C).
 *
 * Returns:
 *   "exclude"       — student has targetSchoolIds and this school is NOT in it
 *   ""              — not a school-scoped award; no action needed
 *   <non-empty str> — school-scoped but we can't confirm; return as a note
 */
function schoolScopeNote(
  profile: StudentProfile,
  aid: AidRecord
): "exclude" | string {
  if (aid.scope.level !== "school") return "";

  const { scorecardId } = aid.scope;
  const targets = profile.targetSchoolIds ?? [];

  if (targets.length > 0) {
    // Student specified schools — enforce the match.
    if (!targets.includes(scorecardId)) return "exclude";
    return ""; // confirmed school match; no note needed
  }

  // Student didn't specify target schools — can't confirm or deny.
  // Include the award but note that school-specific cost data is pending.
  return `School-specific award (ID: ${scorecardId}) — verify this school is on your list`;
}
