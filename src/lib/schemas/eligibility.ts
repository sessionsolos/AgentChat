/**
 * EligibilityRuleSet — Zod schema + inferred TypeScript type.
 *
 * A recursive, serializable predicate tree used to encode scholarship
 * eligibility criteria. Stored as JSON in the `aid_records.eligibility`
 * column and evaluated by the matching engine (WS-2).
 *
 * Design decisions:
 * - Uses z.lazy() for the recursive composite nodes.
 * - Every leaf carries `weight: "hard" | "soft"`:
 *     hard  = disqualifying if unmet (student is ineligible)
 *     soft  = competitiveness/preference signal (affects feasibilityScore)
 * - The hard/soft distinction is first-class so WS-2 can produce a graded
 *   feasibilityScore (0–100) rather than a binary eligible/ineligible filter.
 */

import { z } from "zod";
import { IncomeBandSchema, USStateSchema } from "./student-profile";

// ---------------------------------------------------------------------------
// Weight — applies to every leaf predicate
// ---------------------------------------------------------------------------

export const WeightSchema = z.enum(["hard", "soft"]);
export type Weight = z.infer<typeof WeightSchema>;

// ---------------------------------------------------------------------------
// Leaf predicates
// ---------------------------------------------------------------------------

export const GpaAtLeastLeafSchema = z.object({
  kind: z.literal("gpaAtLeast"),
  value: z.number().min(0).max(4.0),
  weight: WeightSchema,
});

export const TestAtLeastLeafSchema = z.object({
  kind: z.literal("testAtLeast"),
  test: z.enum(["sat", "act"]),
  value: z.number(),
  weight: WeightSchema,
});

export const GradeLevelInLeafSchema = z.object({
  kind: z.literal("gradeLevelIn"),
  values: z.array(z.enum(["sophomore", "junior", "senior"])),
  weight: WeightSchema,
});

export const ResidencyStateLeafSchema = z.object({
  kind: z.literal("residencyState"),
  state: USStateSchema,
  weight: WeightSchema,
});

export const MajorInLeafSchema = z.object({
  kind: z.literal("majorIn"),
  values: z.array(z.string()),
  weight: WeightSchema,
});

export const IncomeBandAtMostLeafSchema = z.object({
  kind: z.literal("incomeBandAtMost"),
  band: IncomeBandSchema,
  weight: WeightSchema,
});

export const HasActivityLeafSchema = z.object({
  kind: z.literal("hasActivity"),
  tag: z.string(),
  weight: WeightSchema,
});

export const CitizenshipInLeafSchema = z.object({
  kind: z.literal("citizenshipIn"),
  values: z.array(
    z.enum(["us_citizen", "permanent_resident", "daca", "international", "other"])
  ),
  weight: WeightSchema,
});

export const DeadlineAfterLeafSchema = z.object({
  kind: z.literal("deadlineAfter"),
  /** ISO date string, e.g. "2025-03-01" */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  weight: WeightSchema,
});

/** Union of all leaf predicate schemas */
export const LeafPredicateSchema = z.discriminatedUnion("kind", [
  GpaAtLeastLeafSchema,
  TestAtLeastLeafSchema,
  GradeLevelInLeafSchema,
  ResidencyStateLeafSchema,
  MajorInLeafSchema,
  IncomeBandAtMostLeafSchema,
  HasActivityLeafSchema,
  CitizenshipInLeafSchema,
  DeadlineAfterLeafSchema,
]);

export type LeafPredicate = z.infer<typeof LeafPredicateSchema>;

// ---------------------------------------------------------------------------
// Composite nodes (recursive via z.lazy)
// ---------------------------------------------------------------------------

/**
 * EligibilityRuleSet is the union of:
 *   - composite nodes: "all" (AND), "any" (OR), "not" (negation)
 *   - leaf predicates (via LeafPredicateSchema)
 *
 * z.lazy() breaks the circular reference for Zod's type system.
 * The TypeScript type is manually declared to match.
 */

export type AllNode = {
  kind: "all";
  rules: EligibilityRuleSet[];
};

export type AnyNode = {
  kind: "any";
  rules: EligibilityRuleSet[];
};

export type NotNode = {
  kind: "not";
  rule: EligibilityRuleSet;
};

export type EligibilityRuleSet = AllNode | AnyNode | NotNode | LeafPredicate;

// Zod schema — uses z.lazy for the recursive reference
const BaseEligibilityRuleSetSchema: z.ZodType<EligibilityRuleSet> = z.lazy(
  () =>
    z.union([
      z.object({
        kind: z.literal("all"),
        rules: z.array(BaseEligibilityRuleSetSchema),
      }),
      z.object({
        kind: z.literal("any"),
        rules: z.array(BaseEligibilityRuleSetSchema),
      }),
      z.object({
        kind: z.literal("not"),
        rule: BaseEligibilityRuleSetSchema,
      }),
      LeafPredicateSchema,
    ])
);

export const EligibilityRuleSetSchema = BaseEligibilityRuleSetSchema;
