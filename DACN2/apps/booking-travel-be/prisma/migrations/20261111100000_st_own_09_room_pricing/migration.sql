CREATE TYPE "RoomPricingRuleKind" AS ENUM ('DATE', 'HOLIDAY', 'SEASON', 'WEEKDAY', 'WEEKEND');

ALTER TABLE "Room" ADD COLUMN "pricingVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "nightlyRatesSnapshot" JSONB;

CREATE TABLE "RoomPricingRule" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" "RoomPricingRuleKind" NOT NULL,
    "label" TEXT,
    "startDate" DATE NOT NULL,
    "endDateExclusive" DATE NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoomPricingRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoomPricingRule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoomPricingRule_dates_check" CHECK ("endDateExclusive" > "startDate"),
    CONSTRAINT "RoomPricingRule_price_check" CHECK ("price" > 0)
);

CREATE INDEX "RoomPricingRule_roomId_active_startDate_endDateExclusive_idx"
    ON "RoomPricingRule"("roomId", "active", "startDate", "endDateExclusive");

CREATE TABLE "RoomPricingAudit" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomPricingAudit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoomPricingAudit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RoomPricingAudit_roomId_createdAt_idx" ON "RoomPricingAudit"("roomId", "createdAt");
