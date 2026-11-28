DO $$ BEGIN
IF to_regtype('"ContentReportReason"') IS NULL THEN
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'FALSE_INFORMATION', 'PRIVACY', 'OTHER');
END IF;
END $$;
CREATE TYPE "ReportTargetType" AS ENUM ('HOTEL', 'REVIEW', 'REPLY');

ALTER TABLE "HotelReport" ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "resolution" VARCHAR(1000);
ALTER TABLE "HotelReport" ALTER COLUMN "bookingId" DROP NOT NULL;
CREATE INDEX "HotelReport_hotelId_reporterId_status_idx" ON "HotelReport"("hotelId", "reporterId", "status");

ALTER TABLE "ReviewReplyReport" ADD COLUMN "category" "ContentReportReason" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "description" VARCHAR(1000),
ADD COLUMN "status" "HotelReportStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "resolution" VARCHAR(1000);

DO $$ BEGIN
IF to_regclass('"ReviewReport"') IS NULL THEN
CREATE TABLE "ReviewReport" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "ContentReportReason" NOT NULL,
  "description" VARCHAR(1000),
  "status" "HotelReportStatus" NOT NULL DEFAULT 'OPEN',
  "assigneeId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolution" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ReviewReport_status_createdAt_id_idx" ON "ReviewReport"("status", "createdAt", "id");
CREATE INDEX "ReviewReport_reviewId_status_idx" ON "ReviewReport"("reviewId", "status");
CREATE INDEX "ReviewReport_reporterId_createdAt_idx" ON "ReviewReport"("reporterId", "createdAt");
CREATE UNIQUE INDEX "ReviewReport_one_open_per_reporter_idx" ON "ReviewReport"("reviewId", "reporterId") WHERE "status" IN ('OPEN', 'IN_REVIEW');
END IF;
END $$;

CREATE TABLE "ReportModerationAction" (
  "id" TEXT NOT NULL,
  "targetType" "ReportTargetType" NOT NULL,
  "reportId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "beforeState" VARCHAR(32) NOT NULL,
  "afterState" VARCHAR(32) NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportModerationAction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportModerationAction_requestId_key" ON "ReportModerationAction"("requestId");
CREATE INDEX "ReportModerationAction_targetType_reportId_createdAt_idx" ON "ReportModerationAction"("targetType", "reportId", "createdAt");
CREATE INDEX "ReportModerationAction_targetType_targetId_createdAt_idx" ON "ReportModerationAction"("targetType", "targetId", "createdAt");
CREATE INDEX "ReviewReplyReport_status_createdAt_id_idx" ON "ReviewReplyReport"("status", "createdAt", "id");
CREATE INDEX "ReviewReplyReport_replyId_status_idx" ON "ReviewReplyReport"("replyId", "status");
