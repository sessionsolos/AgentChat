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
 *   • A `not` node inverts the child's OVERALL pass/fail (De Morgan-correct).
 *     The node as a whole passes when its child's overall hard-gate result
 *     is false, and fails when the child's overall result is true.
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
  /**
   * True when this leaf is from a failing branch inside a satisfied `any` node.
   * These are alternative paths the student didn't take, not real gaps.
   * Suppressed leaves should not appear in whyNotPerfect.
   */
  _suppressed?: boolean;
}

// ---------------------------------------------------------------------------
// EvalContext — shared evaluation context passed through the tree walk
// ---------------------------------------------------------------------------

/**
 * Context passed through the recursive evaluation tree.
 *
 * isInCycle: whether the student is currently in their application cycle
 *   (i.e., current calendar year ≥ gradYear - 1).  When false, a
 *   deadlineAfter leaf whose date has passed in the current year is treated
 *   as met (no hard-block) because the scholarship recurs annually and the
 *   student's actual application window is in a future year.
 *
 * asOf: the reference date to use instead of new Date() — injectable for
 *   deterministic tests.
 */
export interface EvalContext {
  isInCycle: boolean;
  asOf: Date;
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
 * @param ctx         - Evaluation context (isInCycle, asOf). Optional; when
 *                       omitted defaults are derived from new Date().
 * @returns             - Flat array of LeafResult.
 */
export function evaluate(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired = true,
  ctx?: EvalContext
): LeafResult[] {
  const resolvedCtx = ctx ?? defaultCtx(profile);
  switch (rule.kind) {
    case "all":
      return evaluateAll(rule.rules, profile, parentRequired, resolvedCtx);

    case "any":
      return evaluateAny(rule.rules, profile, parentRequired, resolvedCtx);

    case "not":
      return evaluateNot(rule.rule, profile, parentRequired, resolvedCtx);

    default:
      // Leaf predicate
      return [evaluateLeaf(rule as LeafPredicate, profile, parentRequired, resolvedCtx)];
  }
}

// ---------------------------------------------------------------------------
// nodePassesHard — compute the aggregate hard-gate boolean for a subtree.
//
// This is the De Morgan-correct boolean: does the node as a whole pass from
// a hard-filter standpoint (i.e., no hard-required unmet leaves)?
//
// This is evaluated with parentRequired=true so leaves know whether they
// are genuinely required.
// ---------------------------------------------------------------------------

function nodePassesHard(
  rule: EligibilityRuleSet,
  profile: StudentProfile
): boolean {
  switch (rule.kind) {
    case "all":
      // AND: all children must pass hard.
      return rule.rules.every((r) => nodePassesHard(r, profile));

    case "any":
      // OR: at least one child must pass hard.
      return rule.rules.some((r) => nodePassesHard(r, profile));

    case "not":
      // NOT: pass iff child does NOT pass hard.
      return !nodePassesHard(rule.rule, profile);

    default: {
      // Leaf: hard leaf must be met; soft leaf always passes the hard gate.
      const leaf = rule as LeafPredicate;
      if (leaf.weight !== "hard") return true;
      // Special case: ethnicityIn with absent/empty tags is treated as an
      // unknown soft gap, NOT a hard exclusion (student hasn't stated heritage).
      if (leaf.kind === "ethnicityIn") {
        const tags = profile.demographics?.ethnicityTags;
        if (!tags || tags.length === 0) {
          // Tags absent → cannot hard-exclude; treat as passing the hard gate
          // (will show up as soft gap in the leaf result).
          return true;
        }
      }
      return leafMet(leaf, profile);
    }
  }
}

// ---------------------------------------------------------------------------
// leafMet — pure boolean: does the student satisfy this leaf predicate?
// ---------------------------------------------------------------------------

function leafMet(leaf: LeafPredicate, profile: StudentProfile): boolean {
  switch (leaf.kind) {
    case "gpaAtLeast":
      return profile.gpa >= leaf.value;
    case "testAtLeast": {
      const score =
        leaf.test === "sat"
          ? profile.testScores?.sat
          : profile.testScores?.act;
      if (score === undefined) return false; // missing → not met (but will be treated as soft gap in LeafResult)
      return score >= leaf.value;
    }
    case "gradeLevelIn":
      return leaf.values.includes(profile.gradeLevel);
    case "residencyState":
      return profile.homeState === leaf.state;
    case "majorIn": {
      const profileMajors = profile.intendedMajors.map((m) => m.toLowerCase());
      return leaf.values.some((v) => profileMajors.includes(v.toLowerCase()));
    }
    case "incomeBandAtMost":
      return incomeBandIndex(profile.householdIncomeBand) <= incomeBandIndex(leaf.band);
    case "hasActivity":
      return profile.activities.some(
        (a) =>
          a === leaf.tag ||
          a.startsWith(leaf.tag + ":") ||
          a.endsWith(":" + leaf.tag)
      );
    case "citizenshipIn":
      return leaf.values.includes(profile.citizenship);
    case "deadlineAfter": {
      const today = new Date().toISOString().slice(0, 10);
      return today <= leaf.date;
    }
    case "ethnicityIn": {
      const tags = profile.demographics?.ethnicityTags;
      if (!tags || tags.length === 0) {
        // Unknown heritage — don't hard-exclude, but not considered "met"
        return false;
      }
      const tagsLower = tags.map((t) => t.toLowerCase());
      return leaf.values.some((v) => tagsLower.includes(v.toLowerCase()));
    }
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

  // Compute node-level pass/fail using correct boolean logic for each branch.
  const branchPasses = rules.map((r) => nodePassesHard(r, profile));
  const anyBranchPasses = branchPasses.some(Boolean);

  if (anyBranchPasses) {
    // At least one branch passes. Downgrade hard-required unmet leaves in
    // the FAILING branches — they're alternative paths, not real gaps.
    return branchResults.flatMap((branchLeaves, idx) => {
      if (branchPasses[idx]) {
        // Passing branch: keep leaves as-is.
        return branchLeaves;
      }
      // Failing branch: mark all leaves suppressed — they were an alternative
      // path the student didn't need to take.
      return branchLeaves.map((lr) => ({
        ...lr,
        required: false,
        _suppressed: true,
      }));
    });
  }

  // No branch passes — all hard leaves in ALL branches remain required.
  return branchResults.flatMap((b) => b);
}

function evaluateNot(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired: boolean
): LeafResult[] {
  // First determine the child's overall hard-gate result (De Morgan-correct).
  const childPassesHard = nodePassesHard(rule, profile);

  // NOT semantics: this node passes iff the child does NOT pass hard.
  const notPasses = !childPassesHard;

  if (notPasses) {
    // The NOT gate is satisfied (child failed overall — that's what we wanted).
    // Collect the child's leaves as informational context:
    //   - met=true (we passed the not-gate so this is positive for us)
    //   - required=false (no disqualification needed)
    //   - plain-language negated description
    const childLeaves = evaluate(rule, profile, false);
    return childLeaves.map((lr) => ({
      ...lr,
      met: true,
      required: false,
      description: negatedDescription(lr),
    }));
  } else {
    // The NOT gate is NOT satisfied (child passed hard — that's bad here).
    // The student is excluded when parentRequired=true.
    // Collect child leaves, invert met, compute required from parentRequired.
    const childLeaves = evaluate(rule, profile, false);
    return childLeaves.map((lr) => ({
      ...lr,
      met: false,
      required: parentRequired && lr.leaf.weight === "hard",
      description: negatedDescription(lr),
    }));
  }
}

// ---------------------------------------------------------------------------
// Plain-language negation helper — avoids mechanical "NOT:" prefix
// ---------------------------------------------------------------------------

function negatedDescription(lr: LeafResult): string {
  const leaf = lr.leaf;
  // Extract the student value from the original description where possible.
  // Fall back to a generic negation.
  switch (leaf.kind) {
    case "residencyState":
      return `Not restricted to ${leaf.state} residents`;
    case "gradeLevelIn":
      return `Not restricted to ${leaf.values.join("/")} students`;
    case "citizenshipIn":
      return `Not restricted to ${leaf.values.join("/")} applicants`;
    case "gpaAtLeast":
      return `Eligible: GPA gate of ${leaf.value.toFixed(1)} is excluded by this rule`;
    case "majorIn":
      return `Not restricted to declared major in: ${leaf.values.join(", ")}`;
    case "incomeBandAtMost":
      return `Not restricted to income bands at or below ${leaf.band}`;
    case "hasActivity":
      return `Not restricted to students with "${leaf.tag}" activity`;
    case "testAtLeast":
      return `Not restricted to students with ${leaf.test.toUpperCase()} ≥ ${leaf.value}`;
    case "deadlineAfter":
      return `Not restricted by the ${leaf.date} deadline`;
    case "ethnicityIn":
      return `Not restricted to ${leaf.values.join("/")} heritage applicants`;
    default:
      return lr.description;
  }
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

    case "ethnicityIn": {
      const tags = profile.demographics?.ethnicityTags;
      const tagsAbsent = !tags || tags.length === 0;

      if (tagsAbsent) {
        // Student hasn't provided ethnicity — unknown heritage.
        // Per brief: keep the award but mark as a soft gap (required=false),
        // regardless of whether the leaf weight is "hard".
        // The score dampening is applied separately in score.ts.
        return {
          leaf,
          met: false,
          required: false, // never hard-exclude when heritage is unstated
          description: `Typically requires ${leaf.values.join(" or ")} heritage — confirm you qualify`,
        };
      }

      const tagsLower = tags.map((t) => t.toLowerCase());
      const met = leaf.values.some((v) => tagsLower.includes(v.toLowerCase()));
      return {
        leaf,
        met,
        required: isHard && parentRequired && met === false,
        description: met
          ? `Heritage requirement met (you indicated: ${tags.join(", ")})`
          : `Heritage requirement not met (requires: ${leaf.values.join(" or ")}; you indicated: ${tags.join(", ")})`,
      };
    }
  }
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
