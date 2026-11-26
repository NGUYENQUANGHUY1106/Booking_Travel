ALTER TABLE "Booking" ADD COLUMN "completedAt" TIMESTAMP(3), ADD COLUMN "completionMethod" VARCHAR(32);
ALTER TABLE "BookingStayTransition" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN "collectedById" TEXT, ADD COLUMN "propertyCollectionMethod" VARCHAR(20);

CREATE TABLE "StayHandoverAlert" (
  "bookingId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "inventoryBlockId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  CONSTRAINT "StayHandoverAlert_pkey" PRIMARY KEY ("bookingId")
);
CREATE INDEX "StayHandoverAlert_hotelId_resolvedAt_createdAt_idx" ON "StayHandoverAlert"("hotelId", "resolvedAt", "createdAt");
ALTER TABLE "StayHandoverAlert" ADD CONSTRAINT "StayHandoverAlert_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
