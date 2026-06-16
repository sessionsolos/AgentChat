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
