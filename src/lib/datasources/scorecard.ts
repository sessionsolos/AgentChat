/**
 * College Scorecard datasource.
 *
 * Exports the original stub functions (unchanged contract) plus the new
 * fetchSchoolCosts, fetchSchoolsByIds, and searchSchoolsByName functions.
 *
 * API docs: https://collegescorecard.ed.gov/data/documentation/
 * Key endpoint: GET https://api.data.gov/ed/collegescorecard/v1/schools
 * Authentication: api_key=process.env.DATA_GOV_API_KEY
 *
 * Field names verified against Scorecard documentation and IPEDS variable names:
 *   school.name, school.city, school.state, school.ownership (1=public, 2/3=private)
 *   latest.cost.tuition.in_state, latest.cost.tuition.out_of_state
 *   latest.cost.net_price.public.by_income_level.0-30000
 *   latest.cost.net_price.public.by_income_level.30001-48000
 *   latest.cost.net_price.public.by_income_level.48001-75000
 *   latest.cost.net_price.public.by_income_level.75001-110000
 *   latest.cost.net_price.public.by_income_level.110001-plus
 *   (same paths with .private. for private institutions)
 *   latest.aid.pell_grant_rate  — IPEDS PCTPELL; fraction 0–1
 *   latest.aid.federal_loan_rate — IPEDS PCTFLOAN; fraction 0–1
 *   latest.cost.avg_net_price.public  — overall avg net price (public institutions)
 *   latest.cost.avg_net_price.private — overall avg net price (private institutions)
 */

import type { AidRecord } from "@/lib/schemas/aid-record";
import type {
  SchoolCost,
  SchoolsRequest,
  SchoolSearchResult,
} from "@/lib/schemas/school-cost";
import cachedSchools from "@/data/schools.cache.json";

// ---------------------------------------------------------------------------
// Original stub functions — contract unchanged
// ---------------------------------------------------------------------------

/**
 * Fetch aid records scoped to a specific US state from the Scorecard API.
 *
 * @param state  - 2-letter US state code, e.g. "CA"
 * @returns      - Array of AidRecords for that state.
 * @throws       - "not implemented" until WS-1 fills this in.
 */
export async function fetchAidRecordsByState(
  state: string
): Promise<AidRecord[]> {
  // WS-1: implement Scorecard API call here.
  void state;
  throw new Error("fetchAidRecordsByState: not implemented (WS-1)");
}

/**
 * Fetch institutional aid records for a specific school by Scorecard unitid.
 *
 * @param scorecardId  - College Scorecard unitid string, e.g. "110635"
 * @returns            - Array of AidRecords for that institution.
 * @throws             - "not implemented" until WS-1 fills this in.
 */
export async function fetchAidRecordsBySchool(
  scorecardId: string
): Promise<AidRecord[]> {
  // WS-1: implement Scorecard API call here.
  void scorecardId;
  throw new Error("fetchAidRecordsBySchool: not implemented (WS-1)");
}

/**
 * Look up school metadata by Scorecard unitid.
 * Used by the frontend to display school names for targetSchoolIds.
 *
 * @param scorecardId  - College Scorecard unitid string
 * @returns            - School name and basic metadata, or null if not found.
 */
export async function fetchSchoolMetadata(
  scorecardId: string
): Promise<{ id: string; name: string; city: string; state: string } | null> {
  const cached = getCachedSchools().find((s) => s.id === scorecardId);
  if (cached) {
    return { id: cached.id, name: cached.name, city: cached.city, state: cached.state };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal types for raw Scorecard API response
// ---------------------------------------------------------------------------

interface ScorecardSchool {
  id: number;
  "school.name": string;
  "school.city": string;
  "school.state": string;
  /** 1 = public, 2 = private nonprofit, 3 = private for-profit */
  "school.ownership": number | null;
  "latest.cost.tuition.in_state": number | null;
  "latest.cost.tuition.out_of_state": number | null;
  // Public institution net-price by income level
  "latest.cost.net_price.public.by_income_level.0-30000": number | null;
  "latest.cost.net_price.public.by_income_level.30001-48000": number | null;
  "latest.cost.net_price.public.by_income_level.48001-75000": number | null;
  "latest.cost.net_price.public.by_income_level.75001-110000": number | null;
  "latest.cost.net_price.public.by_income_level.110001-plus": number | null;
  // Private institution net-price by income level
  "latest.cost.net_price.private.by_income_level.0-30000": number | null;
  "latest.cost.net_price.private.by_income_level.30001-48000": number | null;
  "latest.cost.net_price.private.by_income_level.48001-75000": number | null;
  "latest.cost.net_price.private.by_income_level.75001-110000": number | null;
  "latest.cost.net_price.private.by_income_level.110001-plus": number | null;
  // Institutional aid fields (IPEDS)
  "latest.aid.pell_grant_rate": number | null;
  "latest.aid.federal_loan_rate": number | null;
  // Overall average net price (not income-banded)
  "latest.cost.avg_net_price.public": number | null;
  "latest.cost.avg_net_price.private": number | null;
}

interface ScorecardResponse {
  metadata: {
    total: number;
    page: number;
    per_page: number;
  };
  results: ScorecardSchool[];
}

// ---------------------------------------------------------------------------
// Field list for the ?fields= query parameter
// ---------------------------------------------------------------------------

const SCORECARD_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.ownership",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.net_price.public.by_income_level.0-30000",
  "latest.cost.net_price.public.by_income_level.30001-48000",
  "latest.cost.net_price.public.by_income_level.48001-75000",
  "latest.cost.net_price.public.by_income_level.75001-110000",
  "latest.cost.net_price.public.by_income_level.110001-plus",
  "latest.cost.net_price.private.by_income_level.0-30000",
  "latest.cost.net_price.private.by_income_level.30001-48000",
  "latest.cost.net_price.private.by_income_level.48001-75000",
  "latest.cost.net_price.private.by_income_level.75001-110000",
  "latest.cost.net_price.private.by_income_level.110001-plus",
  "latest.aid.pell_grant_rate",
  "latest.aid.federal_loan_rate",
  "latest.cost.avg_net_price.public",
  "latest.cost.avg_net_price.private",
].join(",");

const SCORECARD_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";
const PER_PAGE = 100;
const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function ownershipToControl(ownership: number | null): "public" | "private" {
  return ownership === 1 ? "public" : "private";
}

function mapSchool(raw: ScorecardSchool): SchoolCost {
  const isPublic = raw["school.ownership"] === 1;

  const netPriceByIncome: SchoolCost["netPriceByIncome"] = {};

  if (isPublic) {
    const v0 = raw["latest.cost.net_price.public.by_income_level.0-30000"];
    const v1 = raw["latest.cost.net_price.public.by_income_level.30001-48000"];
    const v2 = raw["latest.cost.net_price.public.by_income_level.48001-75000"];
    const v3 = raw["latest.cost.net_price.public.by_income_level.75001-110000"];
    const v4 = raw["latest.cost.net_price.public.by_income_level.110001-plus"];
    if (v0 != null) netPriceByIncome["0-30k"] = v0;
    if (v1 != null) netPriceByIncome["30-48k"] = v1;
    if (v2 != null) netPriceByIncome["48-75k"] = v2;
    if (v3 != null) netPriceByIncome["75-110k"] = v3;
    if (v4 != null) netPriceByIncome["110k+"] = v4;
  } else {
    const v0 = raw["latest.cost.net_price.private.by_income_level.0-30000"];
    const v1 = raw["latest.cost.net_price.private.by_income_level.30001-48000"];
    const v2 = raw["latest.cost.net_price.private.by_income_level.48001-75000"];
    const v3 = raw["latest.cost.net_price.private.by_income_level.75001-110000"];
    const v4 = raw["latest.cost.net_price.private.by_income_level.110001-plus"];
    if (v0 != null) netPriceByIncome["0-30k"] = v0;
    if (v1 != null) netPriceByIncome["30-48k"] = v1;
    if (v2 != null) netPriceByIncome["48-75k"] = v2;
    if (v3 != null) netPriceByIncome["75-110k"] = v3;
    if (v4 != null) netPriceByIncome["110k+"] = v4;
  }

  // Build institutionalAid — omit keys when null
  const pellRate = raw["latest.aid.pell_grant_rate"];
  const loanRate = raw["latest.aid.federal_loan_rate"];
  const avgNetPriceRaw = isPublic
    ? raw["latest.cost.avg_net_price.public"]
    : raw["latest.cost.avg_net_price.private"];

  const hasAidData = pellRate != null || loanRate != null || avgNetPriceRaw != null;
  const institutionalAid: SchoolCost["institutionalAid"] = hasAidData
    ? {
        ...(pellRate != null ? { pellGrantRate: pellRate } : {}),
        ...(loanRate != null ? { federalLoanRate: loanRate } : {}),
        ...(avgNetPriceRaw != null ? { avgNetPrice: avgNetPriceRaw } : {}),
      }
    : undefined;

  const school: SchoolCost = {
    id: String(raw.id),
    name: raw["school.name"],
    city: raw["school.city"],
    state: raw["school.state"],
    control: ownershipToControl(raw["school.ownership"]),
    netPriceByIncome,
    source: {
      sourceName: "U.S. Department of Education College Scorecard",
      sourceUrl: `https://collegescorecard.ed.gov/school/?${raw.id}-${encodeURIComponent(raw["school.name"].replace(/\s+/g, "-"))}=`,
      lastVerifiedAt: new Date().toISOString().slice(0, 10),
    },
    dataSource: "live",
  };

  if (raw["latest.cost.tuition.in_state"] != null) {
    school.tuitionInState = raw["latest.cost.tuition.in_state"]!;
  }
  if (raw["latest.cost.tuition.out_of_state"] != null) {
    school.tuitionOutOfState = raw["latest.cost.tuition.out_of_state"]!;
  }
  if (institutionalAid !== undefined) {
    school.institutionalAid = institutionalAid;
  }

  return school;
}

// ---------------------------------------------------------------------------
// getCachedSchools — typed read of the cache file
// ---------------------------------------------------------------------------

function getCachedSchools(): SchoolCost[] {
  // The JSON is already validated at write time; cast is safe.
  return cachedSchools as unknown as SchoolCost[];
}

// ---------------------------------------------------------------------------
// fetchSchoolCosts — main exported function (state-based)
// ---------------------------------------------------------------------------

/**
 * Fetch school cost data for a given state.
 *
 * Tries the live College Scorecard API first. Falls back gracefully to the
 * local cache whenever:
 *   - DATA_GOV_API_KEY is absent
 *   - The API request fails, times out, or is network-blocked
 *
 * In fallback mode every returned record has dataSource: 'cached'.
 * In live mode every record has dataSource: 'live'.
 *
 * @param req - SchoolsRequest (state is required; other fields are advisory)
 * @returns   - Array of SchoolCost records
 */
export async function fetchSchoolCosts(
  req: SchoolsRequest
): Promise<SchoolCost[]> {
  const apiKey = process.env.DATA_GOV_API_KEY;

  if (!apiKey) {
    return getCachedSchools().filter(
      (s) => s.state === req.state || req.includeOutOfState
    );
  }

  try {
    const results: ScorecardSchool[] = [];
    let page = 0;
    let total = Infinity;

    while (results.length < total) {
      const params = new URLSearchParams({
        api_key: apiKey,
        "school.state": req.state!,
        fields: SCORECARD_FIELDS,
        per_page: String(PER_PAGE),
        page: String(page),
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${SCORECARD_BASE}?${params.toString()}`, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new Error(
          `Scorecard API returned HTTP ${response.status} for state=${req.state}`
        );
      }

      const data = (await response.json()) as ScorecardResponse;
      total = data.metadata.total;
      results.push(...data.results);

      if (data.results.length < PER_PAGE) break;
      page++;
    }

    const schools = results.map(mapSchool);

    // If includeOutOfState was requested and we only fetched one state, we
    // supplement with cached records for out-of-state schools.
    if (req.includeOutOfState) {
      const fetchedIds = new Set(schools.map((s) => s.id));
      const extraCached = getCachedSchools().filter(
        (s) => s.state !== req.state && !fetchedIds.has(s.id)
      );
      return [...schools, ...extraCached];
    }

    return schools;
  } catch {
    // Network blocked, timeout, API error — fall back to cache silently.
    return getCachedSchools().filter(
      (s) => s.state === req.state || req.includeOutOfState
    );
  }
}

// ---------------------------------------------------------------------------
// fetchSchoolsByIds — lookup by Scorecard unitid list
// ---------------------------------------------------------------------------

/**
 * Fetch full SchoolCost records for a list of Scorecard unitids.
 *
 * Tries the live Scorecard API first (comma-joined id= filter).
 * Falls back to filtering the cached schools by id on any failure or missing key.
 *
 * @param ids - Array of Scorecard unitid strings
 * @returns   - Array of SchoolCost records (may be a subset if some ids are unknown)
 */
export async function fetchSchoolsByIds(ids: string[]): Promise<SchoolCost[]> {
  if (ids.length === 0) return [];

  const apiKey = process.env.DATA_GOV_API_KEY;

  if (!apiKey) {
    return getCachedSchools().filter((s) => ids.includes(s.id));
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      id: ids.join(","),
      fields: SCORECARD_FIELDS,
      per_page: String(PER_PAGE),
      page: "0",
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${SCORECARD_BASE}?${params.toString()}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Scorecard API returned HTTP ${response.status} for ids=${ids.join(",")}`);
    }

    const data = (await response.json()) as ScorecardResponse;
    return data.results.map(mapSchool);
  } catch {
    // Network blocked, timeout, API error — fall back to cache silently.
    return getCachedSchools().filter((s) => ids.includes(s.id));
  }
}

// ---------------------------------------------------------------------------
// searchSchoolsByName — name substring search
// ---------------------------------------------------------------------------

/**
 * Search for schools by name substring.
 *
 * Tries the live Scorecard API first.
 * Falls back to case-insensitive substring matching over the cached schools.
 *
 * @param q     - Search query string (case-insensitive substring)
 * @param limit - Maximum number of results to return (default 10)
 * @returns     - Array of SchoolSearchResult records
 */
export async function searchSchoolsByName(
  q: string,
  limit = 10
): Promise<SchoolSearchResult[]> {
  const apiKey = process.env.DATA_GOV_API_KEY;

  if (!apiKey) {
    return searchCacheByName(q, limit);
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      "school.name": q,
      fields: "id,school.name,school.city,school.state,school.ownership",
      per_page: String(limit),
      page: "0",
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${SCORECARD_BASE}?${params.toString()}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Scorecard API returned HTTP ${response.status} for name search q=${q}`);
    }

    const data = (await response.json()) as ScorecardResponse;
    return data.results.map((raw) => ({
      id: String(raw.id),
      name: raw["school.name"],
      city: raw["school.city"],
      state: raw["school.state"],
      control: ownershipToControl(raw["school.ownership"]),
    }));
  } catch {
    // Network blocked, timeout, API error — fall back to cache silently.
    return searchCacheByName(q, limit);
  }
}

/**
 * Case-insensitive substring search over the cached schools.
 */
function searchCacheByName(q: string, limit: number): SchoolSearchResult[] {
  const lower = q.toLowerCase();
  return getCachedSchools()
    .filter((s) => s.name.toLowerCase().includes(lower))
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      state: s.state,
      control: s.control,
    }));
}
