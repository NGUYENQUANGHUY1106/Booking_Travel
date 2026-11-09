ALTER TABLE "HotelSubmissionAudit" ADD COLUMN "requestId" VARCHAR(80);
CREATE UNIQUE INDEX "HotelSubmissionAudit_requestId_key" ON "HotelSubmissionAudit"("requestId");
