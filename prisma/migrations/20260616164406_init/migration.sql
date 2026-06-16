-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "gradeLevel" TEXT NOT NULL,
    "gradYear" INTEGER NOT NULL,
    "homeState" TEXT NOT NULL,
    "citizenship" TEXT NOT NULL,
    "gpa" REAL NOT NULL,
    "gpaScale" REAL NOT NULL DEFAULT 4.0,
    "testScores" TEXT NOT NULL,
    "intendedMajors" TEXT NOT NULL,
    "targetSchoolIds" TEXT,
    "householdIncomeBand" TEXT NOT NULL,
    "dependentStatus" TEXT,
    "householdSize" INTEGER,
    "activities" TEXT NOT NULL,
    "demographics" TEXT
);

-- CreateTable
CREATE TABLE "aid_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentProfileId" TEXT NOT NULL,
    "aidRecordId" TEXT NOT NULL,
    "feasibilityScore" REAL NOT NULL,
    "band" TEXT NOT NULL,
    "whyEligible" TEXT NOT NULL,
    "whyNotPerfect" TEXT NOT NULL,
    CONSTRAINT "match_results_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "match_results_aidRecordId_fkey" FOREIGN KEY ("aidRecordId") REFERENCES "aid_records" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
