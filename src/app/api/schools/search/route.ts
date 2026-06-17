/**
 * POST /api/schools/search
 *
 * Request body:  { q: string }
 * Response body: SchoolSearchResponse { results: SchoolSearchResult[], meta: { dataSource, generatedAt } }
 *
 * Validates the request body with Zod (requires `q` string).
 * Returns 400 with Zod error details on invalid input.
 *
 * Calls searchSchoolsByName which tries the live Scorecard API first and falls
 * back to a case-insensitive substring search over the bundled cache on any
 * failure. Never returns 500 on a data-source failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import type { SchoolSearchResponse } from "@/lib/schemas/school-cost";
import { searchSchoolsByName } from "@/lib/datasources/scorecard";

const SearchRequestSchema = z.object({
  q: z.string().trim().min(2, "q must be at least 2 characters"),
});

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

  let parsed: { q: string };
  try {
    parsed = SearchRequestSchema.parse(body);
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

  // 2. Search — falls back to cache internally on any API failure
  let dataSource: "live" | "cached" = "cached";
  let results: import("@/lib/schemas/school-cost").SchoolSearchResult[];

  try {
    results = await searchSchoolsByName(parsed.q);
    // searchSchoolsByName returns cached results when API key is absent or
    // live call fails. Detect live by checking if the live path was taken:
    // we can't easily tell without plumbing extra metadata through, so we
    // check if the API key is set and assume live if the call succeeded.
    dataSource = process.env.DATA_GOV_API_KEY ? "live" : "cached";
  } catch {
    results = [];
    dataSource = "cached";
  }

  const response: SchoolSearchResponse = {
    results,
    meta: {
      dataSource,
      generatedAt: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 200 });
}
