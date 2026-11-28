DO $$ BEGIN
IF to_regtype('"ContentReportReason"') IS NULL THEN
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'MISLEADING', 'INAPPROPRIATE', 'OTHER');
END IF;
END $$;

DO $$ BEGIN
IF to_regclass('"ReviewReport"') IS NULL THEN
CREATE TABLE "ReviewReport" (
    "id" TEXT PRIMARY KEY,
    "reviewId" TEXT NOT NULL REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "reporterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "reason" "ContentReportReason" NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "snapshot" VARCHAR(2000) NOT NULL,
    "status" "HotelReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ReviewReport_reviewId_reporterId_key" ON "ReviewReport"("reviewId", "reporterId");
CREATE INDEX "ReviewReport_status_createdAt_id_idx" ON "ReviewReport"("status", "createdAt", "id");
END IF;
END $$;
