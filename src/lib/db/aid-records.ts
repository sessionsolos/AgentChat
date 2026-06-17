/**
 * DB helper — loads all AidRecords from SQLite, JSON-parses every complex
 * field, and validates each record against AidRecordSchema.
 *
 * Throws if any stored record fails Zod validation — this surfaces data
 * corruption early rather than silently passing bad records to the engine.
 */

import { prisma } from "@/lib/db";
import { AidRecordSchema } from "@/lib/schemas/aid-record";
import type { AidRecord } from "@/lib/schemas/aid-record";

/**
 * Fetch all rows from `aid_records`, deserialise JSON columns, and
 * validate each row against AidRecordSchema.
 *
 * @returns Validated AidRecord array (may be empty if table is empty).
 * @throws  ZodError if any stored row fails schema validation.
 */
export async function loadAllAidRecords(): Promise<AidRecord[]> {
  const rows = await prisma.aidRecord.findMany();

  return rows.map((row) => {
    const raw = {
      id: row.id,
      name: row.name,
      provider: row.provider,
      type: row.type,
      selectivity: row.selectivity,
      award: JSON.parse(row.award),
      deadline: JSON.parse(row.deadline),
      applyUrl: row.applyUrl ?? undefined,
      sourceUrl: row.sourceUrl,
      sourceName: row.sourceName,
      lastVerifiedAt: row.lastVerifiedAt,
      scope: JSON.parse(row.scope),
      tags: JSON.parse(row.tags),
      eligibility: JSON.parse(row.eligibility),
    };

    // parse() throws ZodError on invalid data — intentional
    return AidRecordSchema.parse(raw);
  });
}
