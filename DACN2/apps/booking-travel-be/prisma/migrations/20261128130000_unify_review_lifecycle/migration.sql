-- Reconcile databases initialized from either review feature branch.
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Review' AND column_name = 'authorId') THEN
  ALTER TABLE "Review" RENAME COLUMN "authorId" TO "userId";
  ALTER TABLE "Review" RENAME CONSTRAINT "Review_authorId_fkey" TO "Review_userId_fkey";
  ALTER TABLE "Review" RENAME COLUMN "content" TO "comment";
  UPDATE "Review" SET "hiddenAt" = "updatedAt", "moderationLockedAt" = "updatedAt" WHERE NOT "isVisible";
  ALTER TABLE "Review" DROP COLUMN "isVisible";
  DROP INDEX IF EXISTS "Review_authorId_createdAt_idx";
END IF;
END $$;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "title" VARCHAR(120);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "cleanliness" INTEGER CHECK ("cleanliness" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "location" INTEGER CHECK ("location" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "service" INTEGER CHECK ("service" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "facilities" INTEGER CHECK ("facilities" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "comfort" INTEGER CHECK ("comfort" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "value" INTEGER CHECK ("value" BETWEEN 1 AND 10);
UPDATE "Review" SET "cleanliness" = "rating" WHERE "cleanliness" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "cleanliness" SET NOT NULL;
UPDATE "Review" SET "location" = "rating" WHERE "location" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "location" SET NOT NULL;
UPDATE "Review" SET "service" = "rating" WHERE "service" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "service" SET NOT NULL;
UPDATE "Review" SET "facilities" = "rating" WHERE "facilities" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "facilities" SET NOT NULL;
UPDATE "Review" SET "comfort" = "rating" WHERE "comfort" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "comfort" SET NOT NULL;
UPDATE "Review" SET "value" = "rating" WHERE "value" IS NULL;
ALTER TABLE "Review" ALTER COLUMN "value" SET NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX IF NOT EXISTS "Review_hotelId_createdAt_id_idx" ON "Review"("hotelId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "Review_userId_createdAt_id_idx" ON "Review"("userId", "createdAt", "id");
UPDATE "Hotel" h SET "reviewCount" = totals.count, "reviewRatingSum" = totals.rating
FROM (SELECT hotels.id, COUNT(r.id)::int AS count, COALESCE(SUM(r.rating), 0)::int AS rating FROM "Hotel" hotels
LEFT JOIN "Review" r ON r."hotelId" = hotels.id AND r."deletedAt" IS NULL AND r."hiddenAt" IS NULL GROUP BY hotels.id) totals
WHERE h.id = totals.id;
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'HARASSMENT';
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'MISLEADING';
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'INAPPROPRIATE';
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'OFFENSIVE';
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'FALSE_INFORMATION';
ALTER TYPE "ContentReportReason" ADD VALUE IF NOT EXISTS 'PRIVACY';
ALTER TABLE "ReviewReport"
  ADD COLUMN IF NOT EXISTS "snapshot" VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS "assigneeId" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolution" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "ReviewReport" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
UPDATE "ReviewReport" AS report SET "snapshot" = review."comment" FROM "Review" review WHERE report."reviewId" = review.id AND report."snapshot" IS NULL;
ALTER TABLE "ReviewReport" ALTER COLUMN "updatedAt" SET NOT NULL, ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "description" DROP NOT NULL, ALTER COLUMN "snapshot" DROP NOT NULL;
DROP INDEX IF EXISTS "ReviewReport_reviewId_reporterId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReport_one_open_per_reporter_idx" ON "ReviewReport"("reviewId", "reporterId") WHERE "status" IN ('OPEN', 'IN_REVIEW');
CREATE INDEX IF NOT EXISTS "ReviewReport_reviewId_status_idx" ON "ReviewReport"("reviewId", "status");
CREATE INDEX IF NOT EXISTS "ReviewReport_reporterId_createdAt_idx" ON "ReviewReport"("reporterId", "createdAt");
