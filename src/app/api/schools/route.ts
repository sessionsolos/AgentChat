/**
 * POST /api/schools
 *
 * Request body:  SchoolsRequest  { state, incomeBand?, majors?, includeOutOfState? }
 * Response body: SchoolsResponse { schools: SchoolCost[], meta: { dataSource, generatedAt } }
 *
 * Validates the request body with SchoolsRequestSchema (Zod).
 * Returns 400 with Zod error details on invalid input.
 *
 * Calls fetchSchoolCosts which tries the live Scorecard API first and falls
 * back to the bundled cache on any failure. Never returns 500 on a data-source
 * failure — cache ensures there is always something to return.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { SchoolsRequestSchema } from "@/lib/schemas/school-cost";
import type { SchoolsResponse } from "@/lib/schemas/school-cost";
import { fetchSchoolCosts } from "@/lib/datasources/scorecard";
import cachedSchools from "@/data/schools.cache.json";
import type { SchoolCost } from "@/lib/schemas/school-cost";

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

  let parsedRequest: import("@/lib/schemas/school-cost").SchoolsRequest;
  try {
    parsedRequest = SchoolsRequestSchema.parse(body);
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

  // 2. Fetch school costs — falls back to cache internally on any API failure
  let schools: SchoolCost[];
  let dataSource: "live" | "cached";

  try {
    schools = await fetchSchoolCosts(parsedRequest);
    // Determine whether the response came from live or cache by inspecting the
    // first record (all records from a single call share the same dataSource).
    dataSource = schools.length > 0 && schools[0].dataSource === "live"
      ? "live"
      : "cached";
  } catch {
    // Belt-and-suspenders: fetchSchoolCosts should never throw, but if it does
    // we serve the full cache rather than returning 500.
    schools = (cachedSchools as unknown as SchoolCost[]).filter(
      (s) => s.state === parsedRequest.state || parsedRequest.includeOutOfState
    );
    dataSource = "cached";
  }

  const response: SchoolsResponse = {
    schools,
    meta: {
      dataSource,
      generatedAt: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 200 });
}
