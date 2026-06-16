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
 *   • A `not` node inverts the child's overall pass/fail (De Morgan-correct).
 *     The node as a whole passes when its child's overall result is false,
 *     and fails when its child's overall result is true.
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
// NodeResult — internal: the boolean outcome of an entire subtree
// ---------------------------------------------------------------------------

interface NodeResult {
  /** Aggregate pass/fail for the node as a whole (De Morgan-correct) */
  passes: boolean;
  /** Flat leaf results for scoring/explanations */
  leaves: LeafResult[];
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
  return evaluateNode(rule, profile, parentRequired).leaves;
}

// ---------------------------------------------------------------------------
// evaluateNode — returns NodeResult with both aggregate passes and leaves
// ---------------------------------------------------------------------------

function evaluateNode(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired: boolean
): NodeResult {
  switch (rule.kind) {
    case "all":
      return evaluateAll(rule.rules, profile, parentRequired);

    case "any":
      return evaluateAny(rule.rules, profile, parentRequired);

    case "not":
      return evaluateNot(rule.rule, profile, parentRequired);

    default:
      // Leaf predicate
      return evaluateLeafNode(rule as LeafPredicate, profile, parentRequired);
  }
}

// ---------------------------------------------------------------------------
// Composite node evaluators
// ---------------------------------------------------------------------------

function evaluateAll(
  rules: EligibilityRuleSet[],
  profile: StudentProfile,
  parentRequired: boolean
): NodeResult {
  // In an `all` node every child must pass.  The parent's required-ness
  // propagates directly to every child.
  const childResults = rules.map((r) => evaluateNode(r, profile, parentRequired));
  const passes = childResults.every((c) => c.passes);
  return {
    passes,
    leaves: childResults.flatMap((c) => c.leaves),
  };
}

function evaluateAny(
  rules: EligibilityRuleSet[],
  profile: StudentProfile,
  parentRequired: boolean
): NodeResult {
  // Evaluate every branch.
  const childResults = rules.map((r) => evaluateNode(r, profile, parentRequired));

  // OR semantics: the any-node passes if at least one child passes.
  const anyChildPasses = childResults.some((c) => c.passes);

  if (anyChildPasses) {
    // At least one branch passes — downgrade hard-required unmet leaves in
    // the FAILING branches so they are not treated as disqualifying.
    const leaves = childResults.flatMap((childResult) => {
      if (childResult.passes) {
        // Passing branch: keep leaves as-is.
        return childResult.leaves;
      }
      // Failing branch: it was an alternative path; downgrade all its
      // hard-required unmet leaves to not-required (and suppress from
      // whyNotPerfect by marking them as met=true, required=false).
      return childResult.leaves.map((lr) => ({
        ...lr,
        // If this branch didn't pass and wasn't needed (sibling passed),
        // suppress this leaf from explanations entirely.
        required: false,
        met: lr.met,
        // Mark suppressed so explain.ts can skip it from whyNotPerfect too.
        _suppressed: true,
      }));
    });
    return { passes: true, leaves };
  }

  // No branch passes — all hard leaves in ALL branches remain required.
  return {
    passes: false,
    leaves: childResults.flatMap((c) => c.leaves),
  };
}

function evaluateNot(
  rule: EligibilityRuleSet,
  profile: StudentProfile,
  parentRequired: boolean
): NodeResult {
  // Evaluate the child without propagating parentRequired yet — we need
  // to know the child's aggregate outcome first.
  const child = evaluateNode(rule, profile, false);

  // NOT semantics: the NOT-node passes iff the child does NOT pass.
  const passes = !child.passes;

  if (passes) {
    // The NOT-node is satisfied (child failed overall).
    // Surface the child's leaves as met=true (we passed the not-gate),
    // not-required (no remaining disqualification), with plain-language
    // description reflecting the negated sense.
    const leaves = child.leaves.map((lr) => ({
      ...lr,
      met: true,
      required: false,
      description: negatedDescription(lr),
    }));
    return { passes: true, leaves };
  } else {
    // The NOT-node fails (child passed overall — that's bad here).
    // If parentRequired, this is a hard disqualification.
    // Surface the child's leaves as met=false with negated descriptions.
    const leaves = child.leaves.map((lr) => ({
      ...lr,
      met: false,
      required: parentRequired && lr.leaf.weight === "hard",
      description: negatedDescription(lr),
    }));
    return { passes: false, leaves };
  }
}

// ---------------------------------------------------------------------------
// Plain-language negation helper
// ---------------------------------------------------------------------------

/**
 * Converts a leaf description to its negated sense without mechanical "NOT:" prefix.
 */
function negatedDescription(lr: LeafResult): string {
  const leaf = lr.leaf;
  switch (leaf.kind) {
    case "residencyState":
      return `Not restricted to ${leaf.state} residents (you: ${lr.description.includes("(you:") ? lr.description.split("(you:")[1].replace(")", "").trim() : "n/a"})`;
    case "gradeLevelIn":
      return `Not restricted to ${leaf.values.join("/")} students`;
    case "citizenshipIn":
      return `Not restricted to ${leaf.values.join("/")} applicants`;
    case "gpaAtLeast":
      return `Eligible: GPA threshold does not apply here (${leaf.value.toFixed(1)} requirement inverted)`;
    case "majorIn":
      return `Not restricted to declared major in: ${leaf.values.join(", ")}`;
    case "incomeBandAtMost":
      return `Not restricted to income bands at or below ${leaf.band}`;
    case "hasActivity":
      return `Not restricted to students with "${leaf.tag}" activity`;
    case "testAtLeast":
      return `Not restricted to students with ${leaf.test.toUpperCase()} ≥ ${leaf.value}`;
    case "deadlineAfter":
      return `Not restricted by deadline ${leaf.date}`;
    default:
      // Fallback: use original description without "NOT:" mechanical prefix
      return lr.description;
  }
}

// ---------------------------------------------------------------------------
// Leaf evaluator (returns NodeResult)
// ---------------------------------------------------------------------------

function evaluateLeafNode(
  leaf: LeafPredicate,
  profile: StudentProfile,
  parentRequired: boolean
): NodeResult {
  const lr = evaluateLeaf(leaf, profile, parentRequired);
  return {
    passes: lr.met || !lr.required,
    leaves: [lr],
  };
}

/**
 * A leaf node "passes" from the hard-filter perspective when:
 *  - met is true, OR
 *  - the leaf is not required (soft weight, or parentRequired=false, or missing optional test)
 * A leaf node "fails" (would disqualify) only when required=true AND met=false.
 */

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
