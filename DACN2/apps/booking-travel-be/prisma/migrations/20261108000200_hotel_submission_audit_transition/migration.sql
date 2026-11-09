ALTER TABLE "HotelSubmissionAudit"
  ADD COLUMN "oldStatus" "HotelStatus",
  ADD COLUMN "newStatus" "HotelStatus";

UPDATE "HotelSubmissionAudit"
SET "oldStatus" = CASE WHEN "action" IN ('APPROVED', 'REJECTED') THEN 'PENDING'::"HotelStatus" ELSE NULL END,
    "newStatus" = CASE
      WHEN "action" = 'SUBMITTED' THEN 'PENDING'::"HotelStatus"
      WHEN "action" = 'APPROVED' THEN 'APPROVED'::"HotelStatus"
      WHEN "action" = 'REJECTED' THEN 'REJECTED'::"HotelStatus"
      ELSE NULL
    END;
