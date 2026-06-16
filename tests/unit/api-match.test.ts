/**
 * Integration tests for POST /api/match
 *
 * Tests the real route handler with the seeded SQLite DB.
 * No HTTP server is needed — we import the POST function directly and pass it
 * a NextRequest instance (Next.js exports these in non-edge Node environments).
 *
 * Covers:
 *   1. Valid profile → 200 with { results, meta } shape
 *   2. Invalid body (missing required fields) → 400 with { error, issues }
 *   3. Malformed JSON body → 400
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/match/route";

// ---------------------------------------------------------------------------
// Helper: build a NextRequest with a JSON body
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/match", () => {
  it("returns 200 with { results, meta } for a valid profile", async () => {
    const profile = {
      gradeLevel: "senior",
      gradYear: 2026,
      homeState: "NE",
      citizenship: "us_citizen",
      gpa: 3.5,
      gpaScale: 4.0,
      testScores: { sat: 1300 },
      intendedMajors: ["Computer Science"],
      householdIncomeBand: "30-48k",
      activities: ["nhs"],
    };

    const req = makeRequest({ profile });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const body = await res.json();

    // Top-level shape
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("meta");

    // meta shape
    expect(typeof body.meta.total).toBe("number");
    expect(body.meta.total).toBeGreaterThanOrEqual(0);
    expect(typeof body.meta.generatedAt).toBe("string");
    // generatedAt must be a valid ISO datetime
    expect(() => new Date(body.meta.generatedAt)).not.toThrow();
    expect(isNaN(new Date(body.meta.generatedAt).getTime())).toBe(false);

    // results is an array
    expect(Array.isArray(body.results)).toBe(true);

    // meta.total matches results array length
    expect(body.meta.total).toBe(body.results.length);

    // Each result has the expected shape
    for (const result of body.results) {
      expect(result).toHaveProperty("aid");
      expect(result).toHaveProperty("feasibilityScore");
      expect(result).toHaveProperty("band");
      expect(result).toHaveProperty("whyEligible");
      expect(result).toHaveProperty("whyNotPerfect");
      expect(result).toHaveProperty("citation");

      // citation must have a sourceUrl
      expect(typeof result.citation.sourceUrl).toBe("string");
      expect(result.citation.sourceUrl.length).toBeGreaterThan(0);

      // band is one of the valid values
      expect(["strong", "possible", "reach"]).toContain(result.band);

      // feasibilityScore is in [0, 100]
      expect(result.feasibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.feasibilityScore).toBeLessThanOrEqual(100);
    }

    // For a NE senior the susan-buffett award must appear (known hard NE requirement met)
    const ids = body.results.map((r: { aid: { id: string } }) => r.aid.id);
    expect(ids).toContain("susan-buffett-scholarship-2026");
  });

  it("returns 400 with { error, issues } when required profile fields are missing", async () => {
    // Send a profile missing gradeLevel, homeState, citizenship, etc.
    const req = makeRequest({ profile: { gpa: 3.0 } });
    const res = await POST(req);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("issues");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it("returns 400 when the request body is entirely missing the profile key", async () => {
    // {} is valid JSON but fails MatchRequestSchema (missing profile)
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("issues");
  });

  it("returns 400 for malformed JSON", async () => {
    // Manually craft a request with invalid JSON body
    const req = new NextRequest("http://localhost/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ this is not json ]",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
