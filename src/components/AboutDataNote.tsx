"use client";

import { useState } from "react";

/**
 * Expandable "About this data" note shown alongside scholarship results.
 * Explains provenance, scope, and how to vet each award.
 */
export function AboutDataNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
          <svg
            className="w-4 h-4 shrink-0 text-blue-600"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
          About this data
        </span>
        <svg
          className={`w-4 h-4 text-blue-600 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-blue-900 space-y-3 border-t border-blue-200">
          <div className="space-y-2">
            <p>
              <strong>Scholarships</strong> — every award shown here is
              hand-curated from official sources such as scholarship provider
              websites, government programs, and established nonprofit
              foundations. Click any{" "}
              <span className="inline-flex items-center gap-1 align-bottom rounded bg-green-100 border border-green-200 px-1.5 py-0.5 text-xs font-semibold text-green-800">
                Verified source &#8599;
              </span>{" "}
              link to view the primary source and confirm the current details.
            </p>
            <p>
              <strong>This is a starter set, not a comprehensive list.</strong>{" "}
              There are thousands of scholarships across the country. These 32
              awards represent a curated sample covering a range of backgrounds,
              majors, and locations — a strong starting point, not an exhaustive
              search.
            </p>
            <p>
              <strong>School cost data</strong> — tuition and net price figures
              come from the U.S. Department of Education&apos;s{" "}
              <a
                href="https://collegescorecard.ed.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-blue-700 transition-colors font-medium"
              >
                College Scorecard &#8599;
              </a>
              . When a free API key is configured (
              <code className="font-mono text-xs">DATA_GOV_API_KEY</code>),
              figures are fetched live; otherwise a labeled sample is shown.
            </p>
            <p className="text-xs text-blue-700 border-t border-blue-200 pt-2">
              <strong>Always verify with the provider.</strong> Eligibility
              requirements, award amounts, and deadlines change. Treat these
              results as a research starting point, not a guarantee.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
