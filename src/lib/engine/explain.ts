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
 * @param leaves    - All leaf results from evaluate().
 * @param aid       - The AidRecord (for deadline urgency checks).
 * @param isInCycle - Whether the student is in their application cycle (senior
 *                    year or later). When false (underclassman), past dated
 *                    deadlines are treated as annual recurrences, not closures.
 * @param gradYear  - The student's expected graduation year (used for the
 *                    informational recurring-cycle message).
 * @param asOf      - The reference date to use for "today" (injectable for
 *                    testing; defaults to new Date() when omitted).
 * @returns           { whyEligible, whyNotPerfect }
 */
export function buildExplanations(
  leaves: LeafResult[],
  aid: AidRecord,
  isInCycle: boolean,
  gradYear: number,
  asOf?: Date
): Explanations {
  const whyEligible: string[] = [];
  const whyNotPerfect: string[] = [];

  for (const lr of leaves) {
    // Skip leaves from failing branches of a satisfied `any` node — those
    // represent alternative paths the student didn't need to take, not gaps.
    if (lr._suppressed) continue;

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
  // For underclassmen (not in-cycle), show a recurring-cycle note instead.
  const deadlineNote = buildDeadlineNote(aid, isInCycle, gradYear, asOf);
  if (deadlineNote) {
    // Prepend so urgency is visible at the top.
    whyNotPerfect.unshift(deadlineNote);
  }

  // Selectivity: for a competitive/highly-selective award, this is often the
  // main reason a qualifying student still ranks "possible" or "reach" rather
  // than "strong". Surface it so the band is explainable (a card shouldn't show
  // all green checks and an unexplained low score).
  const selectivityNote = buildSelectivityNote(aid);
  if (selectivityNote) {
    whyNotPerfect.push(selectivityNote);
  }

  return { whyEligible, whyNotPerfect };
}

// ---------------------------------------------------------------------------
// Deadline urgency helper
// ---------------------------------------------------------------------------

/**
 * Build a deadline note appropriate for the student's application cycle.
 *
 * - In-cycle (senior/applying now): surface passed-deadline warnings and
 *   urgency notes as before.
 * - Out-of-cycle (underclassman): do NOT label a past dated deadline as
 *   "passed" or "closed". Instead, show an informational annual-recurrence
 *   note with the student's expected application window.
 */
function buildDeadlineNote(
  aid: AidRecord,
  isInCycle: boolean,
  gradYear: number,
  asOf?: Date
): string | null {
  if (aid.deadline.type !== "date") return null;

  const today = asOf ? new Date(asOf) : new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(aid.deadline.date);
  deadlineDate.setHours(0, 0, 0, 0);

  const daysUntil = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (!isInCycle) {
    // Underclassman: treat any dated deadline as a recurring annual window.
    // Extract Month name from the deadline date for the informational note.
    const month = deadlineDate.toLocaleString("en-US", { month: "long" });
    const applicationYear = gradYear - 1;
    return `Annual deadline (~${month}); your application window is your senior year (~${applicationYear})`;
  }

  // In-cycle behavior (unchanged):
  if (daysUntil < 0) {
    return `Deadline has already passed (${aid.deadline.date}) — check for updated dates`;
  }

  if (daysUntil <= DEADLINE_WARN_DAYS) {
    return `Deadline is soon: ${aid.deadline.date} (${daysUntil} day${daysUntil === 1 ? "" : "s"} away)`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Selectivity helper
// ---------------------------------------------------------------------------

/**
 * Explain how competitive an award is, so a qualifying student understands why
 * it may rank "possible" or "reach" rather than "strong". `open` awards have no
 * competitive selection step, so they get no note.
 */
function buildSelectivityNote(aid: AidRecord): string | null {
  switch (aid.selectivity) {
    case "highly_selective":
      return "Highly selective — a nationally competitive award; meeting the requirements doesn't guarantee selection.";
    case "competitive":
      return "Competitive — qualifying applicants are not guaranteed an award.";
    default:
      return null; // "open" awards (need/eligibility-based, no competitive selection)
  }
}
