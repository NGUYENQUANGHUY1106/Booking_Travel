ALTER TABLE "Hotel" ADD COLUMN "restrictionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "HotelRestrictionAudit" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeStatus" "HotelStatus" NOT NULL,
  "afterStatus" "HotelStatus" NOT NULL,
  "beforeVisible" BOOLEAN NOT NULL,
  "afterVisible" BOOLEAN NOT NULL,
  "profileVersion" INTEGER NOT NULL,
  "restrictionVersion" INTEGER NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "evidenceReference" VARCHAR(500),
  "futureBookingCount" INTEGER NOT NULL DEFAULT 0,
  "requestId" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelRestrictionAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelRestrictionAudit_requestId_key" ON "HotelRestrictionAudit"("requestId");
CREATE INDEX "HotelRestrictionAudit_hotelId_createdAt_idx" ON "HotelRestrictionAudit"("hotelId", "createdAt");
ALTER TABLE "HotelRestrictionAudit" ADD CONSTRAINT "HotelRestrictionAudit_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelRestrictionAudit" ADD CONSTRAINT "HotelRestrictionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HotelRestrictionNotification" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelRestrictionNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelRestrictionNotification_decisionId_recipientId_key" ON "HotelRestrictionNotification"("decisionId", "recipientId");
CREATE INDEX "HotelRestrictionNotification_recipientId_createdAt_idx" ON "HotelRestrictionNotification"("recipientId", "createdAt");
ALTER TABLE "HotelRestrictionNotification" ADD CONSTRAINT "HotelRestrictionNotification_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "HotelRestrictionAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelRestrictionNotification" ADD CONSTRAINT "HotelRestrictionNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HotelBookingOperationalTask" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "HotelBookingOperationalTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelBookingOperationalTask_decisionId_bookingId_key" ON "HotelBookingOperationalTask"("decisionId", "bookingId");
CREATE INDEX "HotelBookingOperationalTask_hotelId_status_createdAt_idx" ON "HotelBookingOperationalTask"("hotelId", "status", "createdAt");
ALTER TABLE "HotelBookingOperationalTask" ADD CONSTRAINT "HotelBookingOperationalTask_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "HotelRestrictionAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelBookingOperationalTask" ADD CONSTRAINT "HotelBookingOperationalTask_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelBookingOperationalTask" ADD CONSTRAINT "HotelBookingOperationalTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Hotel_status_isVisible_deletedAt_idx" ON "Hotel"("status", "isVisible", "deletedAt");
