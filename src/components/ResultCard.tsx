import type { MatchResult, FeasibilityBand } from "@/lib/schemas";

const BAND_STYLES: Record<
  FeasibilityBand,
  { badge: string; border: string; score: string }
> = {
  strong: {
    badge: "bg-green-100 text-green-800 border border-green-300",
    border: "border-l-4 border-l-green-500",
    score: "text-green-700",
  },
  possible: {
    badge: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    border: "border-l-4 border-l-yellow-400",
    score: "text-yellow-700",
  },
  reach: {
    badge: "bg-orange-100 text-orange-800 border border-orange-300",
    border: "border-l-4 border-l-orange-500",
    score: "text-orange-700",
  },
};

const BAND_LABELS: Record<FeasibilityBand, string> = {
  strong: "Strong Match",
  possible: "Possible Match",
  reach: "Reach",
};

const AID_TYPE_LABELS: Record<string, string> = {
  scholarship: "Scholarship",
  grant: "Grant",
  institutional_aid: "Institutional Aid",
};

function formatAmount(min?: number, max?: number): string {
  if (!min && !max) return "Amount varies";
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return "Amount varies";
}

function formatDeadline(deadline: MatchResult["aid"]["deadline"]): string {
  if (deadline.type === "date") {
    const d = new Date(deadline.date + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (deadline.type === "rolling") return "Rolling deadline";
  return "Deadline unknown";
}

export function ResultCard({ result }: { result: MatchResult }) {
  const { aid, feasibilityScore, band, whyEligible, whyNotPerfect, citation } =
    result;
  const styles = BAND_STYLES[band];

  return (
    <article
      className={`bg-white rounded-xl shadow-sm overflow-hidden ${styles.border} border border-gray-200`}
      aria-label={aid.name}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${styles.badge}`}
            >
              {BAND_LABELS[band]}
            </span>
            <span className="text-xs text-gray-500">
              {AID_TYPE_LABELS[aid.type] ?? aid.type}
            </span>
            {aid.award.renewable && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Renewable
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 leading-snug">
            {aid.name}
          </h3>
          <p className="text-sm text-gray-600 mt-0.5">{aid.provider}</p>
        </div>

        {/* Score circle */}
        <div
          className="flex-shrink-0 flex flex-col items-center"
          aria-label={`Feasibility score: ${feasibilityScore} out of 100`}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
              band === "strong"
                ? "border-green-400 bg-green-50 text-green-700"
                : band === "possible"
                ? "border-yellow-400 bg-yellow-50 text-yellow-700"
                : "border-orange-400 bg-orange-50 text-orange-700"
            }`}
          >
            {feasibilityScore}
          </div>
          <span className="text-xs text-gray-400 mt-1">/ 100</span>
        </div>
      </div>

      {/* Amount + Deadline strip */}
      <div className="px-5 py-3 bg-gray-50 border-y border-gray-100 flex flex-wrap gap-x-8 gap-y-1">
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">
            Award
          </span>
          <p className="text-sm font-semibold text-gray-800">
            {formatAmount(aid.award.amountMin, aid.award.amountMax)}
          </p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">
            Deadline
          </span>
          <p className="text-sm font-semibold text-gray-800">
            {formatDeadline(aid.deadline)}
          </p>
        </div>
      </div>

      {/* Why eligible / why not perfect */}
      <div className="px-5 py-4 space-y-4">
        {whyEligible.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">
              Why you qualify
            </h4>
            <ul className="space-y-1">
              {whyEligible.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg
                    className="w-4 h-4 text-green-500 mt-0.5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {whyNotPerfect.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Things to note
            </h4>
            <ul className="space-y-1">
              {whyNotPerfect.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                  <svg
                    className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer: citation + apply */}
      <div className="px-5 pb-5 space-y-3">
        {/* Verified source — prominent, clickable */}
        <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <svg
            className="w-4 h-4 text-green-600 mt-0.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-green-800">
              Verified source:{" "}
            </span>
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-green-700 underline underline-offset-2 hover:text-green-900 transition-colors break-all"
            >
              {citation.sourceName} &#8599;
            </a>
            <span className="text-xs text-green-700">
              {" "}&#8212; verified {citation.lastVerifiedAt}
            </span>
          </div>
        </div>

        {/* Apply button */}
        {aid.applyUrl && (
          <div className="flex justify-end">
            <a
              href={aid.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 active:bg-blue-900 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Apply
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
