import type { MatchResult, FeasibilityBand } from "@/lib/schemas";
import { ResultCard } from "./ResultCard";
import { Disclaimer } from "./Disclaimer";
import { AboutDataNote } from "./AboutDataNote";

interface ResultsPanelProps {
  results: MatchResult[];
  generatedAt: string;
}

const BAND_ORDER: FeasibilityBand[] = ["strong", "possible", "reach"];

const BAND_HEADINGS: Record<FeasibilityBand, string> = {
  strong: "Strong Matches",
  possible: "Possible Matches",
  reach: "Reach Scholarships",
};

const BAND_DESCRIPTIONS: Record<FeasibilityBand, string> = {
  strong: "You meet the key criteria — these are your strongest opportunities.",
  possible:
    "You meet many criteria; some requirements may be selective or competitive.",
  reach: "Worth keeping an eye on — these are more competitive or criteria-constrained. Great ones to work toward.",
};

export function ResultsPanel({ results, generatedAt }: ResultsPanelProps) {
  if (results.length === 0) {
    return (
      <section aria-label="No results" className="space-y-4">
        <Disclaimer compact />
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
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            No matches found yet
          </h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            We didn&apos;t find scholarships matching your profile right now.
            Try adding more activities, broadening your intended majors, or
            check back as new scholarships are added — many open up in junior
            year.
          </p>
        </div>
      </section>
    );
  }

  const byBand: Partial<Record<FeasibilityBand, MatchResult[]>> = {};
  for (const result of results) {
    if (!byBand[result.band]) byBand[result.band] = [];
    byBand[result.band]!.push(result);
  }

  const generatedDate = new Date(generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section aria-label="Scholarship results" className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {results.length} Scholarship{results.length !== 1 ? "s" : ""} Found
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Results are based on your profile — eligibility and amounts may vary. Always confirm directly with the provider.
          </p>
        </div>
        <p className="text-xs text-gray-400">Generated {generatedDate}</p>
      </div>

      <Disclaimer compact />

      <AboutDataNote />

      {BAND_ORDER.map((band) => {
        const group = byBand[band];
        if (!group || group.length === 0) return null;

        return (
          <div key={band} className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                {BAND_HEADINGS[band]}{" "}
                <span className="text-gray-400 font-normal text-base">
                  ({group.length})
                </span>
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {BAND_DESCRIPTIONS[band]}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {group.map((result) => (
                <ResultCard key={result.aid.id} result={result} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
