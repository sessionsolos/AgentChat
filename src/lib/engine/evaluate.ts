/**
 * Recursive evaluator for EligibilityRuleSet.
 *
 * The evaluator walks the rule tree and returns a flat list of LeafResult
 * values.  The caller (score.ts / explain.ts) interprets those results
 * rather than a single boolean, so every leaf's context is preserved.
 *
 * Hard-filter semantics (from the brief):
 *   • A hard leaf that is NOT met is "required-and-failed" only when the
 *     tree structure actually requires it.  In an `any` node only ONE
 *     branch needs to succeed; in an `all` node ALL must succeed.
 *   • A `not` node inverts the child result; if the child is a hard leaf
 *     the NOT-child is still treated as hard (negating a hard requirement
 *     is itself a hard requirement).
 *   • Missing optional profile fields (e.g., no SAT) are treated as
 *     "unknown/not-yet-met" — a soft gap — unless the leaf is hard AND
 *     there is no alternative branch (any-node) that passes.
 */

import type {
  EligibilityRuleSet,
  LeafPredicate,
} from "@/lib/schemas/eligibility";
import type { StudentProfile, IncomeBand } from "@/lib/schemas/student-profile";

// ---------------------------------------------------------------------------
// Income band ordering (low → high)
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
// LeafResult — per-leaf evaluation output
// ---------------------------------------------------------------------------

export interface LeafResult {
  /** The original leaf predicate */
  leaf: LeafPredicate;
  /** Whether the leaf predicate is met for this student */
  met: boolean;
  /**
   * Whether this leaf was "required" in its tree position — i.e., an unmet
   * hard leaf in an `all` chain, or a negated-hard that is violated.
   * true  → being unmet here is a hard disqualification
   * false → being unmet here is a soft gap (or was in an any-branch where
   *         another branch passed)
   */
  required: boolean;
  /** Human-readable description of what was tested and the student's value */
  description: string;
}

// ---------------------------------------------------------------------------
// evaluate — returns all leaf results flattened, each tagged with whether
// it was truly required by the tree structure.
// ---------------------------------------------------------------------------

/**
 * Evaluates the rule tree for a student and returns per-leaf results.
 *
 * @param rule        - The rule node to evaluate (recursive).
 * @param profile     - The student's profile.
 * @param parentRequired - Whether the current node is required (hard) by its
 *                       parent chain.  Defaults to true (top-level all nodes
 *                       are always required).
 * @returns             - Flat array of LeafResult.
 */
export function evaluate(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired = true
): LeafResult[] {
  switch (rule.kind) {
    case "all":
      return evaluateAll(rule.rules, profile, parentRequired);

    case "any":
      return evaluateAny(rule.rules, profile, parentRequired);

    case "not":
      return evaluateNot(rule.rule, profile, parentRequired);

    default:
      // Leaf predicate
      return [evaluateLeaf(rule as LeafPredicate, profile, parentRequired)];
  }
}

// ---------------------------------------------------------------------------
// Composite node evaluators
// ---------------------------------------------------------------------------

function evaluateAll(
  rules: EligibilityRuleSet[],
  profile: StudentProfile,
  parentRequired: boolean
): LeafResult[] {
  // In an `all` node every child must pass.  The parent's required-ness
  // propagates directly to every child.
  return rules.flatMap((r) => evaluate(r, profile, parentRequired));
}

function evaluateAny(
  rules: EligibilityRuleSet[],
  profile: StudentProfile,
  parentRequired: boolean
): LeafResult[] {
  // Evaluate every branch.
  const branchResults = rules.map((r) => evaluate(r, profile, parentRequired));

  // Check whether at least one branch fully passes (no hard-required unmet leaves).
  const anyBranchPasses = branchResults.some((branchLeaves) =>
    branchPasses(branchLeaves)
  );

  // If at least one branch passes, then any hard leaves in the failing
  // branches are NOT disqualifying — re-tag them as not-required.
  if (anyBranchPasses) {
    return branchResults.flatMap((branchLeaves) => {
      const thisBranchPasses = branchPasses(branchLeaves);
      if (thisBranchPasses) {
        return branchLeaves;
      }
      // Failing branch: downgrade hard-required unmet to not-required
      return branchLeaves.map((lr) =>
        lr.required && !lr.met ? { ...lr, required: false } : lr
      );
    });
  }

  // No branch passes — all hard leaves in ALL branches remain required.
  // (The student fails this any-node; the exact disqualifications bubble up.)
  return branchResults.flatMap((b) => b);
}

function evaluateNot(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired: boolean
): LeafResult[] {
  const inner = evaluate(rule, profile, parentRequired);
  // Invert the `met` flag for every leaf.  The `required` tag stays the
  // same — a hard requirement inside a NOT is still hard.
  return inner.map((lr) => ({
    ...lr,
    met: !lr.met,
    description: `NOT: ${lr.description}`,
  }));
}

// ---------------------------------------------------------------------------
// Leaf evaluator
// ---------------------------------------------------------------------------

function evaluateLeaf(
  leaf: LeafPredicate,
  profile: StudentProfile,
  parentRequired: boolean
): LeafResult {
  const isHard = leaf.weight === "hard";
  // A leaf is "required" only when its weight is hard AND the parent chain
  // required it.  Soft leaves are never disqualifying.
  const required = isHard && parentRequired;

  switch (leaf.kind) {
    case "gpaAtLeast": {
      const met = profile.gpa >= leaf.value;
      return {
        leaf,
        met,
        required,
        description: met
          ? `Meets the ${leaf.value.toFixed(1)} GPA minimum (you: ${profile.gpa.toFixed(2)})`
          : `GPA below the ${leaf.value.toFixed(1)} minimum (you: ${profile.gpa.toFixed(2)})`,
      };
    }

    case "testAtLeast": {
      const score =
        leaf.test === "sat"
          ? profile.testScores?.sat
          : profile.testScores?.act;
      if (score === undefined) {
        // No test score provided — treat as unknown/not-yet-met
        // Only hard-disqualifying if required AND no score provided.
        // We don't auto-fail on missing optional test scores for soft leaves.
        return {
          leaf,
          met: false,
          // Downgrade to soft gap when score is missing so an unsubmitted
          // score doesn't hard-block a student who might take the test.
          required: false,
          description: `${leaf.test.toUpperCase()} score not provided (required: ${leaf.value})`,
        };
      }
      const met = score >= leaf.value;
      return {
        leaf,
        met,
        required,
        description: met
          ? `Meets the ${leaf.test.toUpperCase()} minimum of ${leaf.value} (you: ${score})`
          : `${leaf.test.toUpperCase()} score below the ${leaf.value} minimum (you: ${score})`,
      };
    }

    case "gradeLevelIn": {
      const met = leaf.values.includes(profile.gradeLevel);
      return {
        leaf,
        met,
        required,
        description: met
          ? `Open to ${leaf.values.join("/")} students (you: ${profile.gradeLevel})`
          : `Grade level not eligible (requires: ${leaf.values.join(" or ")}, you: ${profile.gradeLevel})`,
      };
    }

    case "residencyState": {
      const met = profile.homeState === leaf.state;
      return {
        leaf,
        met,
        required,
        description: met
          ? `Open to ${leaf.state} residents (you: ${profile.homeState})`
          : `Requires ${leaf.state} residency (you: ${profile.homeState})`,
      };
    }

    case "majorIn": {
      // Case-insensitive comparison
      const profileMajors = profile.intendedMajors.map((m) => m.toLowerCase());
      const leafMajors = leaf.values.map((v) => v.toLowerCase());
      const match = leafMajors.find((m) => profileMajors.includes(m));
      const met = match !== undefined;
      return {
        leaf,
        met,
        required,
        description: met
          ? `Matches your intended major (${leaf.values.join(", ")})`
          : `Prefers a declared major in: ${leaf.values.join(", ")}`,
      };
    }

    case "incomeBandAtMost": {
      const studentIdx = incomeBandIndex(profile.householdIncomeBand);
      const maxIdx = incomeBandIndex(leaf.band);
      const met = studentIdx <= maxIdx;
      return {
        leaf,
        met,
        required,
        description: met
          ? `Need-based: your income band (${profile.householdIncomeBand}) is within the target range (≤${leaf.band})`
          : `Income band (${profile.householdIncomeBand}) exceeds the need-based ceiling (${leaf.band})`,
      };
    }

    case "hasActivity": {
      const met = profile.activities.some(
        (a) =>
          a === leaf.tag ||
          a.startsWith(leaf.tag + ":") ||
          a.endsWith(":" + leaf.tag)
      );
      return {
        leaf,
        met,
        required,
        description: met
          ? `Matches your ${leaf.tag} activity`
          : `Prefers students with the "${leaf.tag}" activity`,
      };
    }

    case "citizenshipIn": {
      const met = leaf.values.includes(profile.citizenship);
      return {
        leaf,
        met,
        required,
        description: met
          ? `Open to ${leaf.values.join("/")} applicants (you: ${profile.citizenship})`
          : `Citizenship not eligible (requires: ${leaf.values.join(" or ")}, you: ${profile.citizenship})`,
      };
    }

    case "deadlineAfter": {
      // Use today's date for deadline comparison
      const today = new Date().toISOString().slice(0, 10);
      const met = today <= leaf.date;
      const daysUntil = Math.ceil(
        (new Date(leaf.date).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return {
        leaf,
        met,
        required,
        description: met
          ? `Deadline is open (${leaf.date}; ${daysUntil} days away)`
          : `Deadline has passed (${leaf.date})`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: does a branch's leaf set contain no hard-required unmet leaves?
// ---------------------------------------------------------------------------

function branchPasses(leaves: LeafResult[]): boolean {
  return !leaves.some((lr) => lr.required && !lr.met);
}

// ---------------------------------------------------------------------------
// Exported helper: is the ruleset obtainable (no hard disqualifications)?
// ---------------------------------------------------------------------------

/**
 * Returns true if the evaluation produced no hard-required unmet leaves.
 * This is the "can obtain" predicate used by the hard filter.
 */
export function isObtainable(leaves: LeafResult[]): boolean {
  return !leaves.some((lr) => lr.required && !lr.met);
}
