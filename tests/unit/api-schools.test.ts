/**
 * Unit tests for POST /api/schools and POST /api/schools/search
 *
 * Tests run entirely offline (no DATA_GOV_API_KEY set, no network calls).
 * Covered:
 *   POST /api/schools
 *     1. By-id: returns selected cached schools with correct shape & dataSource:'cached'
 *     2. By-id: out-of-state school (Ohio State) is found
 *     3. By-id: unknown ids return empty schools array
 *     4. By-state: returns NE schools (existing behavior, no regression)
 *     5. Missing body / bad schema → 400
 *
 *   POST /api/schools/search
 *     1. Substring match over cache returns expected results
 *     2. Case-insensitive match
 *     3. Returns correct meta.dataSource:'cached' with no key
 *     4. 400 on missing q
 *     5. 400 on empty q
 *     6. 400 on malformed JSON
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SchoolCostSchema, SchoolSearchResultSchema } from "@/lib/schemas/school-cost";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not valid json ]",
  });
}

// ---------------------------------------------------------------------------
// Ensure DATA_GOV_API_KEY is absent so every test uses the cache
// ---------------------------------------------------------------------------

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.DATA_GOV_API_KEY;
  delete process.env.DATA_GOV_API_KEY;
});

afterEach(() => {
  if (savedKey !== undefined) {
    process.env.DATA_GOV_API_KEY = savedKey;
  } else {
    delete process.env.DATA_GOV_API_KEY;
  }
});

// ---------------------------------------------------------------------------
// POST /api/schools — by-id
// ---------------------------------------------------------------------------

describe("POST /api/schools — by-id lookup", () => {
  it("returns cached schools for known unitids", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {
      ids: ["181464", "204796"], // UNL (NE) + Ohio State (OH)
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("schools");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.schools)).toBe(true);
    expect(body.schools.length).toBeGreaterThan(0);

    // meta.dataSource should be 'cached' (no API key)
    expect(body.meta.dataSource).toBe("cached");
    expect(typeof body.meta.generatedAt).toBe("string");
    expect(() => new Date(body.meta.generatedAt)).not.toThrow();
  });

  it("includes the out-of-state Ohio State school when requested by id", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {
      ids: ["204796"], // Ohio State University – Main Campus
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.schools.map((s: { id: string }) => s.id);
    expect(ids).toContain("204796");

    // The Ohio State entry should pass the schema
    const ohioState = body.schools.find((s: { id: string }) => s.id === "204796");
    expect(ohioState).toBeDefined();
    expect(() => SchoolCostSchema.parse(ohioState)).not.toThrow();
    expect(ohioState.state).toBe("OH");
  });

  it("returns dataSource:'cached' for each school in the id-based response", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {
      ids: ["181464", "181002"],
    });
    const res = await POST(req);
    const body = await res.json();

    for (const school of body.schools) {
      expect(school.dataSource).toBe("cached");
    }
  });

  it("returns empty schools array for unknown ids", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {
      ids: ["999999999"],
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schools).toHaveLength(0);
    expect(body.meta.dataSource).toBe("cached");
  });

  it("all returned schools by id pass SchoolCostSchema.parse()", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {
      ids: ["181464", "181002", "204796", "170976"],
    });
    const res = await POST(req);
    const body = await res.json();

    for (const school of body.schools) {
      expect(() => SchoolCostSchema.parse(school)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/schools — state-based (regression, existing behavior)
// ---------------------------------------------------------------------------

describe("POST /api/schools — state-based lookup (regression)", () => {
  it("returns NE schools when state=NE", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", { state: "NE" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schools.length).toBeGreaterThan(0);
    for (const s of body.schools) {
      expect(s.state).toBe("NE");
    }
    expect(body.meta.dataSource).toBe("cached");
  });

  it("returns 400 when body is empty (no state or ids)", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeRequest("http://localhost/api/schools", {});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("issues");
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/schools/route");
    const req = makeMalformedRequest("http://localhost/api/schools");
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/schools/search
// ---------------------------------------------------------------------------

describe("POST /api/schools/search", () => {
  it("returns results for a substring match over the cache", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeRequest("http://localhost/api/schools/search", { q: "Nebraska" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);

    // Every result should include "Nebraska" in the name (case-insensitive)
    for (const r of body.results) {
      expect(r.name.toLowerCase()).toContain("nebraska");
    }
  });

  it("performs case-insensitive matching", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const reqUpper = makeRequest("http://localhost/api/schools/search", { q: "NEBRASKA" });
    const reqLower = makeRequest("http://localhost/api/schools/search", { q: "nebraska" });

    const [resUpper, resLower] = await Promise.all([POST(reqUpper), POST(reqLower)]);

    expect(resUpper.status).toBe(200);
    expect(resLower.status).toBe(200);

    const bodyUpper = await resUpper.json();
    const bodyLower = await resLower.json();

    // Same set of ids regardless of case
    const idsUpper = bodyUpper.results.map((r: { id: string }) => r.id).sort();
    const idsLower = bodyLower.results.map((r: { id: string }) => r.id).sort();
    expect(idsUpper).toEqual(idsLower);
  });

  it("returns meta.dataSource:'cached' with no API key", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeRequest("http://localhost/api/schools/search", { q: "University" });
    const res = await POST(req);
    const body = await res.json();

    expect(body.meta.dataSource).toBe("cached");
  });

  it("each result has the expected shape and passes SchoolSearchResultSchema", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeRequest("http://localhost/api/schools/search", { q: "University" });
    const res = await POST(req);
    const body = await res.json();

    for (const r of body.results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("city");
      expect(r).toHaveProperty("state");
      expect(r).toHaveProperty("control");
      expect(() => SchoolSearchResultSchema.parse(r)).not.toThrow();
    }
  });

  it("returns 400 when q is missing from the request body", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeRequest("http://localhost/api/schools/search", {});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("issues");
  });

  it("returns 400 when q is an empty string", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeRequest("http://localhost/api/schools/search", { q: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    const req = makeMalformedRequest("http://localhost/api/schools/search");
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("result count is capped at 10 by default", async () => {
    const { POST } = await import("@/app/api/schools/search/route");
    // "University" matches many schools in the expanded cache
    const req = makeRequest("http://localhost/api/schools/search", { q: "University" });
    const res = await POST(req);
    const body = await res.json();

    expect(body.results.length).toBeLessThanOrEqual(10);
  });
});
