/**
 * Tunable thresholds and weights for the feasibility engine.
 *
 * All values are in one place so tests and future tuning don't require
 * touching scoring or evaluation logic.
 */

// ---------------------------------------------------------------------------
// Band thresholds
// ---------------------------------------------------------------------------

/** Minimum feasibilityScore (0–100) for the "strong" band */
export const STRONG_THRESHOLD = 80;

/** Minimum feasibilityScore (0–100) for the "possible" band */
export const POSSIBLE_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Score component weights (must sum to 1.0)
// ---------------------------------------------------------------------------

/**
 * How much of the final score comes from eligibility margin
 * (how comfortably hard bars are cleared).
 */
export const WEIGHT_ELIGIBILITY_MARGIN = 0.40;

/**
 * How much of the final score comes from soft-criteria fit
 * (fraction of optional criteria that are met).
 */
export const WEIGHT_SOFT_FIT = 0.45;

/**
 * How much of the final score comes from competitiveness signals
 * (e.g., award amount — higher awards typically imply more competition).
 */
export const WEIGHT_COMPETITIVENESS = 0.15;

// ---------------------------------------------------------------------------
// Eligibility margin helpers
// ---------------------------------------------------------------------------

/**
 * GPA margin scoring: how many points above the hard floor earns a full margin.
 * E.g., 0.5 GPA points above the requirement = full contribution.
 */
export const GPA_MARGIN_FULL = 0.5;

/**
 * SAT margin scoring: how many points above the hard floor earns full margin.
 */
export const SAT_MARGIN_FULL = 200;

/**
 * ACT margin scoring: how many points above the hard floor earns full margin.
 */
export const ACT_MARGIN_FULL = 4;

// ---------------------------------------------------------------------------
// Competitiveness signals
// ---------------------------------------------------------------------------

/**
 * Award amounts used to normalise a "competitiveness" signal.
 * Awards with amountMax above this are treated as highly competitive.
 */
export const HIGH_AWARD_THRESHOLD = 25_000;

// ---------------------------------------------------------------------------
// Deadline urgency window (days)
// ---------------------------------------------------------------------------

/** Deadlines this many days away or fewer generate an urgency note */
export const DEADLINE_WARN_DAYS = 30;

// ---------------------------------------------------------------------------
// Selectivity adjustments
//
// Selectivity adjusts the raw score via a multiplier on the competitiveness
// component AND enforces a hard band ceiling.
//
// Design:
//   - highly_selective: multiplier 0.3 (strong penalty) + band cap "possible"
//       Exception: a genuinely exceptional student (GPA ≥ EXCEPTIONAL_GPA_FLOOR
//       AND a top test score present) lifts the cap one notch but still max
//       "possible".  In practice they can reach "strong" only if score ≥ 90
//       after the penalty, which almost never happens for a typical applicant.
//   - competitive:       multiplier 0.75 (moderate penalty) + no band cap
//   - open:              multiplier 1.0  (no penalty)        + no band cap
// ---------------------------------------------------------------------------

/**
 * Score multiplier applied to the raw (pre-selectivity) feasibility score.
 * Reduces the final score for more selective awards so they land in lower bands.
 */
export const SELECTIVITY_MULTIPLIER: Record<string, number> = {
  open: 1.0,
  competitive: 0.85,
  highly_selective: 0.55,
};

/**
 * Hard band ceiling for highly_selective awards for a typical applicant.
 * The engine will never return "strong" for highly_selective unless the
 * student is genuinely exceptional (GPA ≥ EXCEPTIONAL_GPA_FLOOR AND a top
 * test score is present).  Even then they cap at "possible".
 */
export const HIGHLY_SELECTIVE_BAND_CAP = "possible" as const;

/**
 * GPA floor below which a student is NOT considered "exceptional".
 * Used in the selectivity band-cap exception check.
 */
export const EXCEPTIONAL_GPA_FLOOR = 3.9;

/**
 * Top SAT score threshold to count as "exceptional" for the cap exception.
 */
export const EXCEPTIONAL_SAT_FLOOR = 1500;

/**
 * Top ACT score threshold to count as "exceptional" for the cap exception.
 */
export const EXCEPTIONAL_ACT_FLOOR = 34;

/**
 * Score dampening multiplier applied when an ethnicityIn leaf is present but
 * the student has not provided ethnicityTags (unknown heritage).
 * Prevents heritage-gated awards from sitting at the top of results.
 */
export const ETHNICITY_UNKNOWN_PENALTY = 0.65;
