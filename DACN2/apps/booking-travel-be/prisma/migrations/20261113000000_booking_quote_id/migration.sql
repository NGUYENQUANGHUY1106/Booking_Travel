ALTER TABLE "Booking" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "cancellationPolicySnapshot" TEXT;
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");
