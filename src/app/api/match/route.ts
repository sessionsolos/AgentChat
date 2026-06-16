/**
 * POST /api/match
 *
 * Request body:  { profile: StudentProfile }
 * Response body: { results: MatchResult[], meta: { total: number, generatedAt: ISO } }
 *
 * Validates the request body with MatchRequestSchema (Zod).
 * Returns 400 with Zod error details on invalid input.
 *
 * The engine call is stubbed in WS-0 and returns [].
 * WS-2 replaces the engine stub with real scoring logic.
 * WS-1 replaces the empty records array with DB-fetched AidRecords.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { MatchRequestSchema } from "@/lib/schemas/match-result";
import { matchProfile } from "@/lib/engine";
import type { MatchResponse } from "@/lib/schemas/match-result";
import type { AidRecord } from "@/lib/schemas/aid-record";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse and validate the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  let parsedRequest: { profile: import("@/lib/schemas/student-profile").StudentProfile };
  try {
    parsedRequest = MatchRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: err.issues,
        },
        { status: 400 }
      );
    }
    throw err;
  }

  // 2. Load aid records from the database
  // WS-1: replace this stub with a real DB/Scorecard fetch.
  const records: AidRecord[] = [];

  // 3. Run the matching engine
  // WS-2: the engine stub returns [] until scoring is implemented.
  const results = matchProfile(parsedRequest.profile, records);

  // 4. Return the response
  const response: MatchResponse = {
    results,
    meta: {
      total: results.length,
      generatedAt: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 200 });
}
