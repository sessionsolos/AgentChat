-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_aid_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "selectivity" TEXT NOT NULL DEFAULT 'competitive',
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "lastVerifiedAt" TEXT NOT NULL,
    "award" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "applyUrl" TEXT,
    "scope" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL
);
INSERT INTO "new_aid_records" ("applyUrl", "award", "createdAt", "deadline", "eligibility", "id", "lastVerifiedAt", "name", "provider", "scope", "sourceName", "sourceUrl", "tags", "type", "updatedAt") SELECT "applyUrl", "award", "createdAt", "deadline", "eligibility", "id", "lastVerifiedAt", "name", "provider", "scope", "sourceName", "sourceUrl", "tags", "type", "updatedAt" FROM "aid_records";
DROP TABLE "aid_records";
ALTER TABLE "new_aid_records" RENAME TO "aid_records";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
