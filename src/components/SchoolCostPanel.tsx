"use client";

import type { SchoolCost, SchoolsResponse, IncomeBand } from "@/lib/schemas";
import { Disclaimer } from "./Disclaimer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number | undefined | null): string {
  if (n == null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const label = positive
    ? `+${fmt(delta)} vs. in-state`
    : `${fmt(delta)} vs. in-state`;
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
        positive
          ? "bg-orange-100 text-orange-800"
          : "bg-green-100 text-green-800"
      }`}
    >
      {label}
    </span>
  );
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

interface SchoolRowProps {
  school: SchoolCost;
  incomeBand: IncomeBand | undefined;
  homeState: string;
}

function SchoolRow({ school, incomeBand, homeState }: SchoolRowProps) {
  const netPrice = incomeBand ? school.netPriceByIncome[incomeBand] : undefined;
  const isInState = school.state === homeState;

  // Delta: out-of-state tuition minus in-state tuition (when both exist)
  const tDelta =
    school.tuitionOutOfState != null && school.tuitionInState != null
      ? school.tuitionOutOfState - school.tuitionInState
      : null;

  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <ControlBadge control={school.control} />
          {isInState && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
              In-State
            </span>
          )}
        </div>
        <h4 className="text-base font-bold text-gray-900 leading-snug">
          {school.name}
        </h4>
        <p className="text-sm text-gray-500 mt-0.5">
          {school.city}, {school.state}
        </p>
      </div>

      {/* Cost grid */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* In-State Tuition */}
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
            In-State Tuition
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {fmt(school.tuitionInState)}
          </p>
        </div>

        {/* Out-of-State Tuition */}
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
            Out-of-State Tuition
          </p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-800">
              {fmt(school.tuitionOutOfState)}
            </p>
            {!isInState && tDelta !== null && <DeltaBadge delta={tDelta} />}
          </div>
        </div>

        {/* Net Price for income band */}
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
            {incomeBand ? `Net Price (${incomeBand})` : "Net Price"}
          </p>
          <p
            className={`text-sm font-semibold ${
              netPrice != null ? "text-blue-700" : "text-gray-400"
            }`}
          >
            {netPrice != null ? fmt(netPrice) : "Not available"}
          </p>
          {netPrice != null && (
            <p className="text-xs text-gray-400 mt-0.5">
              avg after aid &amp; grants
            </p>
          )}
        </div>
      </div>

      {/* Citation */}
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
// Group heading + grid
// ---------------------------------------------------------------------------

interface GroupProps {
  title: string;
  description: string;
  schools: SchoolCost[];
  incomeBand: IncomeBand | undefined;
  homeState: string;
}

function SchoolGroup({
  title,
  description,
  schools,
  incomeBand,
  homeState,
}: GroupProps) {
  if (schools.length === 0) return null;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800">
          {title}{" "}
          <span className="text-gray-400 font-normal text-base">
            ({schools.length})
          </span>
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {schools.map((s) => (
          <SchoolRow
            key={s.id}
            school={s}
            incomeBand={incomeBand}
            homeState={homeState}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data-source notice
// ---------------------------------------------------------------------------

function DataSourceNotice({
  dataSource,
}: {
  dataSource: "live" | "cached";
}) {
  if (dataSource === "live") {
    return (
      <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2">
        <strong>Live data</strong> &#8212; sourced from the College Scorecard API (api.data.gov).
      </p>
    );
  }
  return (
    <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-3 py-2">
      <strong>Sample data</strong> &#8212; add a free api.data.gov key (
      <code className="font-mono">DATA_GOV_API_KEY</code>) to your{" "}
      <code className="font-mono">.env.local</code> for live results from the
      College Scorecard.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading school costs">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-36 rounded-xl bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type PanelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: SchoolsResponse };

interface SchoolCostPanelProps {
  state: PanelState;
  homeState: string;
  incomeBand: IncomeBand | undefined;
}

export function SchoolCostPanel({
  state,
  homeState,
  incomeBand,
}: SchoolCostPanelProps) {
  if (state.status === "loading") {
    return (
      <section aria-label="School cost comparison loading" className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            School Cost Comparison
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Loading in-state and out-of-state cost data&#8230;
          </p>
        </div>
        <LoadingSkeleton />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="School cost comparison error" className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">
          School Cost Comparison
        </h2>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.message}
        </p>
      </section>
    );
  }

  const { schools, meta } = state.data;

  const inState = schools.filter((s) => s.state === homeState);
  const outOfState = schools.filter((s) => s.state !== homeState);

  const generatedDate = new Date(meta.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section aria-label="School cost comparison" className="space-y-8">
      {/* Section header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            School Cost: In-State vs. Out-of-State
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tuition and net price estimates for schools in and outside{" "}
            <strong>{homeState}</strong>
            {incomeBand ? ` (income band: ${incomeBand})` : ""}.
          </p>
        </div>
        <p className="text-xs text-gray-400">Generated {generatedDate}</p>
      </div>

      {/* Data-source notice */}
      <DataSourceNotice dataSource={meta.dataSource} />

      {/* Informational disclaimer */}
      <Disclaimer compact />

      {/* Empty state */}
      {schools.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422A12.083 12.083 0 0121 12c0 6.627-4.03 12-9 12S3 18.627 3 12c0-.175.006-.35.016-.523L12 14z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No school data found
          </h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            We couldn&apos;t find cost data for schools in your area right now.
            Try broadening your search or check back later.
          </p>
        </div>
      )}

      {/* In-State group */}
      <SchoolGroup
        title="In-State Schools"
        description={`Schools in ${homeState} — you qualify for the in-state tuition rate.`}
        schools={inState}
        incomeBand={incomeBand}
        homeState={homeState}
      />

      {/* Out-of-State group */}
      <SchoolGroup
        title="Out-of-State Schools"
        description="Schools outside your home state — tuition is typically higher, but net price after aid can close the gap."
        schools={outOfState}
        incomeBand={incomeBand}
        homeState={homeState}
      />
    </section>
  );
}
