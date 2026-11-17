ALTER TABLE "Booking"
  ADD COLUMN "ownerInternalNote" VARCHAR(1000),
  ADD COLUMN "ownerNoteUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "ownerNoteUpdatedBy" TEXT;

CREATE INDEX "Booking_hotelId_createdAt_id_idx" ON "Booking"("hotelId", "createdAt", "id");
