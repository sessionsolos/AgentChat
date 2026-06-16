/**
 * College Scorecard datasource — stub for WS-0.
 *
 * WS-1 (Scorecard client + seed dataset) owns this module. Implement the
 * function bodies using the DATA_GOV_API_KEY from process.env.
 *
 * API docs: https://collegescorecard.ed.gov/data/documentation/
 * Key endpoint: GET https://api.data.gov/ed/collegescorecard/v1/schools
 *
 * Authentication: pass `api_key=process.env.DATA_GOV_API_KEY` as a query param.
 *
 * The function signatures below are the contract — do not change them.
 * The /api/match route and seed pipeline depend on fetchAidRecordsByState
 * and fetchAidRecordsBySchool.
 */

import type { AidRecord } from "@/lib/schemas/aid-record";

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
 * @throws             - "not implemented" until WS-1 fills this in.
 */
export async function fetchSchoolMetadata(
  scorecardId: string
): Promise<{ id: string; name: string; city: string; state: string } | null> {
  // WS-1: implement Scorecard API call here.
  void scorecardId;
  throw new Error("fetchSchoolMetadata: not implemented (WS-1)");
}
