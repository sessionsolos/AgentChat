/**
 * Feasibility scoring.
 *
 * Combines three signals into a 0–100 score:
 *
 *  1. Eligibility margin (40 pts)
 *     How comfortably the student clears hard bars.  Each hard leaf that is
 *     met contributes based on how far above the threshold the student is.
 *     Hard leaves that are missing (e.g., no test score) contribute 0.
 *
 *  2. Soft-criteria fit (45 pts)
 *     Fraction of soft predicates that are met × 45.
 *
 *  3. Competitiveness signal (15 pts)
 *     Lower-amount/broader awards score slightly higher (less competition).
 *     Very high award amounts signal more competition → lower contribution.
 *
 * See weights.ts for all tunable constants.
 */

import type { AidRecord } from "@/lib/schemas/aid-record";
import type { LeafPredicate } from "@/lib/schemas/eligibility";
import type { StudentProfile, IncomeBand } from "@/lib/schemas/student-profile";
import type { LeafResult } from "./evaluate";
import {
  WEIGHT_ELIGIBILITY_MARGIN,
  WEIGHT_SOFT_FIT,
  WEIGHT_COMPETITIVENESS,
  GPA_MARGIN_FULL,
  SAT_MARGIN_FULL,
  ACT_MARGIN_FULL,
  HIGH_AWARD_THRESHOLD,
  SELECTIVITY_MULTIPLIER,
  ETHNICITY_UNKNOWN_PENALTY,
  FUTURE_GRADE_PENALTY,
} from "./weights";

// ---------------------------------------------------------------------------
// Income band ordering helper (duplicated intentionally — no shared util file
// between engine sub-modules to keep each independently importable)
// ---------------------------------------------------------------------------

const INCOME_BAND_ORDER: IncomeBand[] = [
  "0-30k",
  "30-48k",
  "48-75k",
  "75-110k",
  "110k+",
];

function incomeBandIndex(band: IncomeBand): number {
  return INCOME_BAND_ORDER.indexOf(band);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a 0–100 feasibility score from the leaf evaluation results.
 *
 * The score has three phases:
 *   1. Raw weighted combination of eligibility margin + soft fit + competitiveness.
 *   2. Selectivity multiplier — reduces the score for more selective awards so
 *      they fall into lower bands for typical applicants.
 *   3. Ethnicity-unknown penalty — if any ethnicityIn leaf is present but the
 *      student did not provide ethnicityTags, apply an additional dampener so
 *      the award cannot sit at the top of results.
 *
 * @param leaves  - All leaf results from the recursive evaluator.
 * @param profile - The student profile (needed for margin calculations).
 * @param aid     - The AidRecord (needed for competitiveness signal).
 * @returns         A number in [0, 100], rounded to one decimal place.
 */
export function computeScore(
  leaves: LeafResult[],
  profile: StudentProfile,
  aid: AidRecord
): number {
  const marginScore = eligibilityMarginScore(leaves, profile) * 100;
  const softScore = softFitScore(leaves) * 100;
  const compScore = competitivenessScore(aid) * 100;

  const raw =
    marginScore * WEIGHT_ELIGIBILITY_MARGIN +
    softScore * WEIGHT_SOFT_FIT +
    compScore * WEIGHT_COMPETITIVENESS;

  // Phase 2: selectivity multiplier
  const selectivity = aid.selectivity ?? "competitive";
  const selectivityMult = SELECTIVITY_MULTIPLIER[selectivity] ?? 1.0;
  const afterSelectivity = raw * selectivityMult;

  // Phase 3: ethnicity-unknown penalty
  // Applied when there are ethnicityIn leaves present AND the student has not
  // provided ethnicityTags (leaves are unmet but not required).
  const hasEthnicityLeaf = leaves.some((lr) => lr.leaf.kind === "ethnicityIn");
  const ethnicityTagsAbsent =
    !profile.demographics?.ethnicityTags ||
    profile.demographics.ethnicityTags.length === 0;
  const ethnicityGap = hasEthnicityLeaf && ethnicityTagsAbsent;

  const afterEthnicity = ethnicityGap
    ? afterSelectivity * ETHNICITY_UNKNOWN_PENALTY
    : afterSelectivity;

  // Phase 4: future-grade penalty
  // Applied when a gradeLevelIn leaf was satisfied only because the student is
  // BELOW the required grade (future-eligible).  The award cannot be obtained
  // this cycle, so we dampen the score so it lands at most in "possible".
  // Fix 2: ignore future-grade leaves that are suppressed (they came from a
  // failing any-branch that the student did not rely on — a sibling branch
  // passed for real, so the future-grade signal is not the reason they passed).
  const hasFutureGradeLeaf = leaves.some(
    (lr) => lr._futureGrade === true && lr._suppressed !== true
  );
  const afterFutureGrade = hasFutureGradeLeaf
    ? afterEthnicity * FUTURE_GRADE_PENALTY
    : afterEthnicity;

  // Clamp to [0, 100] and round to one decimal.
  return Math.round(Math.min(100, Math.max(0, afterFutureGrade)) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Component: eligibility margin (0–1)
// ---------------------------------------------------------------------------

/**
 * For each hard leaf that the student *meets*, compute a margin [0,1] based
 * on how far above the requirement they are.  Average across all hard-met
 * leaves (treats a perfect match with no hard leaves as 0.5 — needs soft
 * criteria to compensate).
 */
function eligibilityMarginScore(
  leaves: LeafResult[],
  profile: StudentProfile
): number {
  const hardMet = leaves.filter(
    (lr) => lr.leaf.weight === "hard" && lr.met
  );

  if (hardMet.length === 0) {
    // No hard bars — award a neutral baseline rather than 0.
    return 0.5;
  }

  const margins = hardMet.map((lr) => leafMargin(lr.leaf, profile));
  return average(margins);
}

/**
 * Returns a [0,1] margin for a met hard leaf, representing how comfortably
 * the student clears the requirement.
 */
function leafMargin(leaf: LeafPredicate, profile: StudentProfile): number {
  switch (leaf.kind) {
    case "gpaAtLeast": {
      const excess = profile.gpa - leaf.value;
      return Math.min(1, Math.max(0, excess / GPA_MARGIN_FULL));
    }

    case "testAtLeast": {
      const score =
        leaf.test === "sat"
          ? profile.testScores?.sat
          : profile.testScores?.act;
      if (score === undefined) return 0;
      const fullMargin = leaf.test === "sat" ? SAT_MARGIN_FULL : ACT_MARGIN_FULL;
      const excess = score - leaf.value;
      return Math.min(1, Math.max(0, excess / fullMargin));
    }

    case "incomeBandAtMost": {
      // More headroom below the ceiling = stronger need signal = better margin.
      const studentIdx = incomeBandIndex(profile.householdIncomeBand);
      const maxIdx = incomeBandIndex(leaf.band);
      const headroom = maxIdx - studentIdx;
      // headroom of 4 (max distance) → 1.0; headroom of 0 → 0.25
      return Math.min(1, 0.25 + (headroom / 4) * 0.75);
    }

    // Binary predicates: met = 1.0, not-met = 0 (handled above by filtering).
    case "gradeLevelIn":
    case "residencyState":
    case "citizenshipIn":
    case "majorIn":
    case "hasActivity":
    case "deadlineAfter":
    case "ethnicityIn":
      return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Component: soft-criteria fit (0–1)
// ---------------------------------------------------------------------------

function softFitScore(leaves: LeafResult[]): number {
  const soft = leaves.filter((lr) => lr.leaf.weight === "soft");
  if (soft.length === 0) return 1.0; // no soft criteria → no penalty
  const metCount = soft.filter((lr) => lr.met).length;
  return metCount / soft.length;
}

// ---------------------------------------------------------------------------
// Component: competitiveness (0–1)
// ---------------------------------------------------------------------------

/**
 * Simple heuristic: higher-dollar awards are more competitive → lower signal.
 * Missing amount data → neutral 0.5.
 */
function competitivenessScore(aid: AidRecord): number {
  const amount = aid.award.amountMax ?? aid.award.amountMin;
  if (amount === undefined) return 0.5;
  if (amount <= 0) return 1.0;
  // Logarithmic decay: HIGH_AWARD_THRESHOLD maps to ~0.2; $1k → ~0.8.
  const ratio = amount / HIGH_AWARD_THRESHOLD;
  return Math.max(0.1, Math.min(1.0, 1 - 0.8 * (Math.log(ratio + 1) / Math.log(2))));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}
