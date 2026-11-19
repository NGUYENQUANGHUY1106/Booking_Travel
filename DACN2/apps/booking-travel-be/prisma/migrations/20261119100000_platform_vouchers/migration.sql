CREATE TYPE "PlatformVoucherStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "PlatformDiscountType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "VoucherRedemptionStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

CREATE TABLE "PlatformVoucher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'PLATFORM',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PlatformVoucherStatus" NOT NULL DEFAULT 'DRAFT',
  "discountType" "PlatformDiscountType" NOT NULL,
  "discountValue" DECIMAL(14,2) NOT NULL,
  "maxDiscount" DECIMAL(14,2),
  "minSpend" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "minNights" INTEGER NOT NULL DEFAULT 1,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "hotelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "eligibleUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "globalLimit" INTEGER NOT NULL,
  "perUserLimit" INTEGER NOT NULL,
  "budget" DECIMAL(14,2) NOT NULL,
  "reservedCount" INTEGER NOT NULL DEFAULT 0,
  "consumedCount" INTEGER NOT NULL DEFAULT 0,
  "reservedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "consumedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformVoucher_code_key" UNIQUE ("code"),
  CONSTRAINT "PlatformVoucher_valid" CHECK (
    "source" = 'PLATFORM' AND "currency" = 'VND'
    AND "code" = upper("code") AND "code" ~ '^[A-Z0-9_-]{4,32}$'
    AND "discountValue" > 0
    AND ("discountType" <> 'PERCENT' OR "discountValue" <= 100)
    AND ("maxDiscount" IS NULL OR "maxDiscount" > 0)
    AND "minSpend" >= 0 AND "minNights" >= 1
    AND "globalLimit" > 0 AND "perUserLimit" > 0 AND "budget" > 0
    AND "startsAt" < "endsAt" AND "version" > 0
    AND "reservedCount" >= 0 AND "consumedCount" >= 0
    AND "reservedCount" + "consumedCount" <= "globalLimit"
    AND "reservedAmount" >= 0 AND "consumedAmount" >= 0
    AND "reservedAmount" + "consumedAmount" <= "budget"
  )
);

CREATE TABLE "VoucherRedemption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "VoucherRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "reservedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "VoucherRedemption_bookingId_key" UNIQUE ("bookingId"),
  CONSTRAINT "VoucherRedemption_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "VoucherRedemption_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "PlatformVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VoucherRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PlatformVoucherAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voucherId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformVoucherAudit_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "PlatformVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Booking" ADD COLUMN "voucherSnapshot" JSONB;

CREATE INDEX "PlatformVoucher_status_startsAt_endsAt_idx" ON "PlatformVoucher"("status", "startsAt", "endsAt");
CREATE INDEX "PlatformVoucher_updatedAt_id_idx" ON "PlatformVoucher"("updatedAt", "id");
CREATE INDEX "VoucherRedemption_voucherId_status_createdAt_idx" ON "VoucherRedemption"("voucherId", "status", "createdAt");
CREATE INDEX "VoucherRedemption_voucherId_userId_status_idx" ON "VoucherRedemption"("voucherId", "userId", "status");
CREATE INDEX "PlatformVoucherAudit_voucherId_createdAt_idx" ON "PlatformVoucherAudit"("voucherId", "createdAt");
