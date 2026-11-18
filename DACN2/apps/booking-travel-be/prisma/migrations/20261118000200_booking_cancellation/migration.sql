ALTER TABLE "Booking"
  ADD COLUMN "cancellationReason" VARCHAR(500),
  ADD COLUMN "cancellationFee" DECIMAL(14, 2),
  ADD COLUMN "refundEstimate" DECIMAL(14, 2);
