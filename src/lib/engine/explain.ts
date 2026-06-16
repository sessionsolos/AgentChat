/**
 * Human-readable explanation builder.
 *
 * Given leaf evaluation results, produces:
 *   whyEligible   — reasons the student qualifies (met leaves, hard or soft)
 *   whyNotPerfect — unmet soft criteria + deadline urgency notes
 *
 * The brief specifies both arrays should be string arrays; each string is a
 * concise, plain-English sentence starting with the criterion and including
 * the student's actual value where relevant.
 */

import type { AidRecord } from "@/lib/schemas/aid-record";
import type { LeafResult } from "./evaluate";
import { DEADLINE_WARN_DAYS } from "./weights";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface Explanations {
  whyEligible: string[];
  whyNotPerfect: string[];
}

/**
 * Build explanation arrays from leaf evaluation results.
 *
 * @param leaves - All leaf results from evaluate().
 * @param aid    - The AidRecord (for deadline urgency checks).
 * @returns        { whyEligible, whyNotPerfect }
 */
export function buildExplanations(
  leaves: LeafResult[],
  aid: AidRecord
): Explanations {
  const whyEligible: string[] = [];
  const whyNotPerfect: string[] = [];

  for (const lr of leaves) {
    if (lr.met) {
      whyEligible.push(lr.description);
    } else if (!lr.required) {
      // Unmet but not disqualifying — soft gap or optional criterion.
      whyNotPerfect.push(lr.description);
    }
    // Hard-required unmet leaves are excluded; those records should have been
    // filtered by the hard filter before reaching this function.
  }

  // Deadline urgency: surface a note if the deadline is within DEADLINE_WARN_DAYS
  // or has already passed, even when covered by a deadlineAfter leaf above.
  const deadlineNote = buildDeadlineNote(aid);
  if (deadlineNote) {
    // Prepend so urgency is visible at the top.
    whyNotPerfect.unshift(deadlineNote);
  }

  return { whyEligible, whyNotPerfect };
}

// ---------------------------------------------------------------------------
// Deadline urgency helper
// ---------------------------------------------------------------------------

function buildDeadlineNote(aid: AidRecord): string | null {
  if (aid.deadline.type !== "date") return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(aid.deadline.date);
  deadlineDate.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) {
    return `Deadline has already passed (${aid.deadline.date}) — check for updated dates`;
  }

  if (daysUntil <= DEADLINE_WARN_DAYS) {
    return `Deadline is soon: ${aid.deadline.date} (${daysUntil} day${daysUntil === 1 ? "" : "s"} away)`;
  }

  return null;
}
