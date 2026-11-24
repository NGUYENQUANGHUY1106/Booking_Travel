CREATE TYPE "OwnerPromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

CREATE TABLE "OwnerPromotion" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "status" "OwnerPromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "discountType" "PlatformDiscountType" NOT NULL,
  "discountValue" DECIMAL(14,2) NOT NULL,
  "maxDiscount" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "stayStart" DATE NOT NULL,
  "stayEnd" DATE NOT NULL,
  "roomIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minNights" INTEGER NOT NULL DEFAULT 1,
  "quota" INTEGER NOT NULL,
  "reservedCount" INTEGER NOT NULL DEFAULT 0,
  "consumedCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerPromotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnerPromotion_valid" CHECK (
    "endsAt" > "startsAt" AND "stayEnd" > "stayStart" AND "minNights" >= 1
    AND "quota" > 0 AND "reservedCount" >= 0 AND "consumedCount" >= 0
    AND "reservedCount" + "consumedCount" <= "quota"
    AND "discountValue" > 0 AND ("maxDiscount" IS NULL OR "maxDiscount" > 0)
    AND "currency" = 'VND'
  )
);

CREATE TABLE "OwnerPromotionUsage" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "VoucherRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "reservedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "OwnerPromotionUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerPromotionAudit" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerPromotionAudit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking" ADD COLUMN "ownerPromotionSnapshot" JSONB;
CREATE UNIQUE INDEX "OwnerPromotionUsage_bookingId_key" ON "OwnerPromotionUsage"("bookingId");
CREATE INDEX "OwnerPromotion_hotelId_status_startsAt_endsAt_idx" ON "OwnerPromotion"("hotelId", "status", "startsAt", "endsAt");
CREATE INDEX "OwnerPromotion_hotelId_createdAt_id_idx" ON "OwnerPromotion"("hotelId", "createdAt", "id");
CREATE INDEX "OwnerPromotionUsage_promotionId_status_idx" ON "OwnerPromotionUsage"("promotionId", "status");
CREATE INDEX "OwnerPromotionAudit_promotionId_createdAt_idx" ON "OwnerPromotionAudit"("promotionId", "createdAt");
ALTER TABLE "OwnerPromotion" ADD CONSTRAINT "OwnerPromotion_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerPromotion" ADD CONSTRAINT "OwnerPromotion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerPromotionUsage" ADD CONSTRAINT "OwnerPromotionUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "OwnerPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerPromotionUsage" ADD CONSTRAINT "OwnerPromotionUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerPromotionAudit" ADD CONSTRAINT "OwnerPromotionAudit_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "OwnerPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
