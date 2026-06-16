/**
 * Prisma seed script — loads scholarships.seed.json into SQLite.
 *
 * Run with: npm run db:seed
 *           (or: npx prisma db seed)
 *
 * Each record is validated against AidRecordSchema before insertion.
 * Any invalid record causes the seed to fail loudly — fix the seed data
 * rather than silently skipping records.
 *
 * Uses CommonJS (ts-node with tsconfig.seed.json) because Prisma's seed
 * runner calls the script directly with ts-node.
 */

import { PrismaClient } from "@prisma/client";
import { AidRecordSchema } from "../src/lib/schemas/aid-record";
import seedData from "../src/data/scholarships.seed.json";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding aid records...");

  let upserted = 0;
  let failed = 0;

  for (const raw of seedData) {
    // Validate against Zod schema — fail loud on any issue
    const parseResult = AidRecordSchema.safeParse(raw);
    if (!parseResult.success) {
      console.error(`\nValidation failed for record id="${(raw as { id?: string }).id}":`);
      console.error(parseResult.error.format());
      failed++;
      continue;
    }

    const record = parseResult.data;

    // Upsert into the database — idempotent re-runs
    await prisma.aidRecord.upsert({
      where: { id: record.id },
      update: {
        name: record.name,
        provider: record.provider,
        type: record.type,
        selectivity: record.selectivity,
        sourceUrl: record.sourceUrl,
        sourceName: record.sourceName,
        lastVerifiedAt: record.lastVerifiedAt,
        award: JSON.stringify(record.award),
        deadline: JSON.stringify(record.deadline),
        applyUrl: record.applyUrl ?? null,
        scope: JSON.stringify(record.scope),
        tags: JSON.stringify(record.tags),
        eligibility: JSON.stringify(record.eligibility),
      },
      create: {
        id: record.id,
        name: record.name,
        provider: record.provider,
        type: record.type,
        selectivity: record.selectivity,
        sourceUrl: record.sourceUrl,
        sourceName: record.sourceName,
        lastVerifiedAt: record.lastVerifiedAt,
        award: JSON.stringify(record.award),
        deadline: JSON.stringify(record.deadline),
        applyUrl: record.applyUrl ?? null,
        scope: JSON.stringify(record.scope),
        tags: JSON.stringify(record.tags),
        eligibility: JSON.stringify(record.eligibility),
      },
    });

    console.log(`  ✓ Upserted: "${record.name}" (${record.id})`);
    upserted++;
  }

  if (failed > 0) {
    throw new Error(
      `Seed completed with ${failed} validation error(s). Fix seed data and re-run.`
    );
  }

  console.log(`\nSeed complete: ${upserted} record(s) upserted.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
