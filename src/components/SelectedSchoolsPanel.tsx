"use client";

import type { SchoolCost, SchoolsResponse, IncomeBand, MatchResult } from "@/lib/schemas";
import { Disclaimer } from "./Disclaimer";

// ---------------------------------------------------------------------------
// Formatting helpers (kept local to avoid coupling to SchoolCostPanel internals)
// ---------------------------------------------------------------------------

function fmtDollars(n: number | undefined | null): string {
  if (n == null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(rate: number | undefined | null): string | null {
  if (rate == null) return null;
  return `${Math.round(rate * 100)}%`;
}

// ---------------------------------------------------------------------------
// DataSourceNotice — mirrors SchoolCostPanel's version to avoid coupling
// ---------------------------------------------------------------------------

function DataSourceNotice({ dataSource }: { dataSource: "live" | "cached" }) {
  if (dataSource === "live") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-300 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wide">
          <svg
            className="w-3.5 h-3.5"
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
          Live data
        </span>
        <p className="text-sm text-green-900">
          <strong>U.S. Dept. of Education College Scorecard</strong> &#8212;{" "}
          costs are pulled live from the federal database.{" "}
          <a
            href="https://collegescorecard.ed.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-green-700 transition-colors"
          >
            collegescorecard.ed.gov &#8599;
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wide mt-0.5">
        <svg
          className="w-3.5 h-3.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        Sample data
      </span>
      <p className="text-sm text-amber-900">
        These are representative sample figures.{" "}
        <strong>
          Add a free{" "}
          <a
            href="https://api.data.gov/signup/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-amber-700 transition-colors"
          >
            api.data.gov &#8599;
          </a>{" "}
          key
        </strong>{" "}
        (<code className="font-mono text-xs">DATA_GOV_API_KEY</code> in{" "}
        <code className="font-mono text-xs">.env.local</code>) to load live
        College Scorecard costs.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading selected school data">
      {[1, 2].map((i) => (
        <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-school card
// ---------------------------------------------------------------------------

interface SchoolCardProps {
  school: SchoolCost;
  incomeBand: IncomeBand | undefined;
  schoolAwards: MatchResult[];
}

function formatAward(min?: number, max?: number): string {
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return "Amount varies";
}

function ControlBadge({ control }: { control: "public" | "private" }) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
        control === "public"
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : "bg-purple-50 text-purple-700 border border-purple-200"
      }`}
    >
      {control === "public" ? "Public" : "Private"}
    </span>
  );
}

function SchoolCard({ school, incomeBand, schoolAwards }: SchoolCardProps) {
  const netPrice = incomeBand ? school.netPriceByIncome[incomeBand] : undefined;
  const aid = school.institutionalAid;

  const pellPct = fmtPct(aid?.pellGrantRate);
  const loanPct = fmtPct(aid?.federalLoanRate);
  const avgNet = aid?.avgNetPrice;

  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <ControlBadge control={school.control} />
        </div>
        <h4 className="text-base font-bold text-gray-900 leading-snug">
          {school.name}
        </h4>
        <p className="text-sm text-gray-500 mt-0.5">
          {school.city}, {school.state}
        </p>
      </div>

      {/* Cost section */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Cost &amp; Aid Data
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Net price for income band */}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
              {incomeBand ? `Net Price (${incomeBand} income)` : "Net Price"}
            </p>
            <p
              className={`text-sm font-semibold ${
                netPrice != null ? "text-blue-700" : "text-gray-400"
              }`}
            >
              {netPrice != null ? fmtDollars(netPrice) : "Not available"}
            </p>
            {netPrice != null && (
              <p className="text-xs text-gray-400 mt-0.5">avg after aid &amp; grants</p>
            )}
          </div>

          {/* Average net price (overall) */}
          {avgNet != null && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
                Average net price
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {fmtDollars(avgNet)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">all income levels</p>
            </div>
          )}

          {/* Pell grant rate */}
          {pellPct && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
                Students receiving Pell grants
              </p>
              <p className="text-sm font-semibold text-gray-800">{pellPct}</p>
            </div>
          )}

          {/* Federal loan rate */}
          {loanPct && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
                Students receiving federal loans
              </p>
              <p className="text-sm font-semibold text-gray-800">{loanPct}</p>
            </div>
          )}
        </div>
      </div>

      {/* No-double-count note */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Net price already reflects average grant aid; awards listed below may further reduce cost &mdash; confirm with the school&apos;s financial aid office.
        </p>
      </div>

      {/* School-specific scholarships */}
      <div className="px-5 py-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Stackable School-Specific Awards
        </h5>
        {schoolAwards.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No school-specific scholarships in our set for this school yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {schoolAwards.map((result) => (
              <li
                key={result.aid.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">
                    {result.aid.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {result.band.charAt(0).toUpperCase() + result.band.slice(1)} match
                  </p>
                </div>
                <div className="text-sm font-semibold text-blue-700 shrink-0">
                  {formatAward(
                    result.aid.award.amountMin,
                    result.aid.award.amountMax
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Source citation */}
      <div className="px-5 pb-4">
        <p className="text-xs text-gray-400">
          Source:{" "}
          <a
            href={school.source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 transition-colors"
          >
            {school.source.sourceName} &#8599;
          </a>
          {" · "}verified {school.source.lastVerifiedAt}
        </p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Panel state type
// ---------------------------------------------------------------------------

type PanelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: SchoolsResponse };

interface SelectedSchoolsPanelProps {
  state: PanelState;
  incomeBand: IncomeBand | undefined;
  matchResults: MatchResult[];
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function SelectedSchoolsPanel({
  state,
  incomeBand,
  matchResults,
}: SelectedSchoolsPanelProps) {
  if (state.status === "loading") {
    return (
      <section aria-label="Your selected schools loading" className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Selected Schools</h2>
          <p className="text-sm text-gray-500 mt-1">
            Loading cost and aid data for your schools&#8230;
          </p>
        </div>
        <LoadingSkeleton />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="Your selected schools error" className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Your Selected Schools</h2>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.message}
        </p>
      </section>
    );
  }

  const { schools, meta } = state.data;

  // Helper: get school-scoped match results for a given school id
  function getSchoolAwards(scorecardId: string): MatchResult[] {
    return matchResults.filter(
      (r) =>
        r.aid.scope.level === "school" &&
        "scorecardId" in r.aid.scope &&
        r.aid.scope.scorecardId === scorecardId
    );
  }

  return (
    <section aria-label="Your selected schools" className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Your Selected Schools</h2>
        <p className="text-sm text-gray-500 mt-1">
          Cost and aid data for the schools you chose
          {incomeBand ? ` (income band: ${incomeBand})` : ""}.
        </p>
      </div>

      {/* Data source notice */}
      <DataSourceNotice dataSource={meta.dataSource} />

      {/* Disclaimer */}
      <Disclaimer compact />

      {/* School cards */}
      <div className="grid grid-cols-1 gap-6">
        {schools.map((school) => (
          <SchoolCard
            key={school.id}
            school={school}
            incomeBand={incomeBand}
            schoolAwards={getSchoolAwards(school.id)}
          />
        ))}
      </div>
    </section>
  );
}
