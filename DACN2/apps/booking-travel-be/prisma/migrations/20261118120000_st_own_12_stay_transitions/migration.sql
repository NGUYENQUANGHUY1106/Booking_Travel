ALTER TABLE "Booking" ADD COLUMN "checkOutTimeSnapshot" TEXT;
ALTER TABLE "Booking" ADD COLUMN "actualCheckInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "actualCheckOutAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "checkedInById" TEXT;
ALTER TABLE "Booking" ADD COLUMN "checkedOutById" TEXT;

UPDATE "Booking" AS b SET "checkOutTimeSnapshot" = h."checkOutTime"
FROM "Hotel" AS h WHERE b."hotelId" = h."id" AND h."checkOutTime" IS NOT NULL;

CREATE TABLE "BookingStayTransition" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(16) NOT NULL,
  "previousStatus" "BookingStatus" NOT NULL,
  "newStatus" "BookingStatus" NOT NULL,
  "verificationMethod" VARCHAR(16) NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "happenedAt" TIMESTAMP(3) NOT NULL,
  "eventType" VARCHAR(40) NOT NULL,
  "correlationId" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingStayTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingStayTransition_bookingId_action_key" ON "BookingStayTransition"("bookingId", "action");
CREATE UNIQUE INDEX "BookingStayTransition_actorId_idempotencyKey_key" ON "BookingStayTransition"("actorId", "idempotencyKey");
CREATE INDEX "BookingStayTransition_hotelId_createdAt_idx" ON "BookingStayTransition"("hotelId", "createdAt");
CREATE INDEX "BookingStayTransition_eventType_createdAt_idx" ON "BookingStayTransition"("eventType", "createdAt");

ALTER TABLE "BookingStayTransition" ADD CONSTRAINT "BookingStayTransition_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingStayTransition" ADD CONSTRAINT "BookingStayTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
