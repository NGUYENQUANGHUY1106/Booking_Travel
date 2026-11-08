CREATE TYPE "HotelSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

ALTER TABLE "HotelSubmission"
  ADD COLUMN "status" "HotelSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reason" VARCHAR(1000),
  ADD COLUMN "decidedById" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

UPDATE "HotelSubmission" AS current
SET "status" = 'SUPERSEDED'
WHERE EXISTS (
  SELECT 1 FROM "HotelSubmission" AS newer
  WHERE newer."hotelId" = current."hotelId"
    AND (newer."submittedAt", newer."id") > (current."submittedAt", current."id")
);

UPDATE "HotelSubmission" AS submission
SET "status" = CASE
  WHEN hotel."status" = 'APPROVED' THEN 'APPROVED'::"HotelSubmissionStatus"
  WHEN hotel."status" = 'REJECTED' THEN 'REJECTED'::"HotelSubmissionStatus"
  WHEN hotel."status" = 'PENDING' THEN 'PENDING'::"HotelSubmissionStatus"
  ELSE 'SUPERSEDED'::"HotelSubmissionStatus"
END
FROM "Hotel" AS hotel
WHERE submission."hotelId" = hotel."id" AND submission."status" = 'PENDING';

CREATE UNIQUE INDEX "HotelSubmission_one_pending_per_hotel"
  ON "HotelSubmission"("hotelId") WHERE "status" = 'PENDING';

CREATE TABLE "HotelSubmissionAudit" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelSubmissionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelSubmissionAudit_hotelId_createdAt_idx"
  ON "HotelSubmissionAudit"("hotelId", "createdAt");
ALTER TABLE "HotelSubmissionAudit" ADD CONSTRAINT "HotelSubmissionAudit_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "HotelSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HotelSubmissionNotification" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelSubmissionNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelSubmissionNotification_submissionId_recipientId_kind_key"
  ON "HotelSubmissionNotification"("submissionId", "recipientId", "kind");
CREATE INDEX "HotelSubmissionNotification_recipientId_createdAt_idx"
  ON "HotelSubmissionNotification"("recipientId", "createdAt");
ALTER TABLE "HotelSubmissionNotification" ADD CONSTRAINT "HotelSubmissionNotification_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "HotelSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
