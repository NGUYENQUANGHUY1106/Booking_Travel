ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUCCESS';
CREATE TYPE "BookingPaymentMethod" AS ENUM ('PAY_AT_HOTEL', 'SIMULATOR');
ALTER TABLE "Booking" ADD COLUMN "paymentDeadline" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "paymentMethod" "BookingPaymentMethod" NOT NULL DEFAULT 'PAY_AT_HOTEL';

-- ST-BKG-04 creates the shared Payment table first. Extend it for the
-- simulator/webhook flow while keeping pay-at-hotel rows valid.
ALTER TABLE "Payment"
  ALTER COLUMN "reference" DROP NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL,
  ALTER COLUMN "method" DROP NOT NULL,
  ALTER COLUMN "idempotencyKey" DROP NOT NULL,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "merchantId" TEXT,
  ADD COLUMN "merchantReference" TEXT,
  ADD COLUMN "providerTxnId" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "succeededAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_merchantReference_key" ON "Payment"("merchantReference");
CREATE UNIQUE INDEX "Payment_providerTxnId_key" ON "Payment"("providerTxnId");
CREATE INDEX "Payment_bookingId_createdAt_idx" ON "Payment"("bookingId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

CREATE TABLE "PaymentWebhookReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "paymentId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentWebhookReceipt_provider_eventId_key" ON "PaymentWebhookReceipt"("provider", "eventId");
CREATE INDEX "PaymentWebhookReceipt_paymentId_createdAt_idx" ON "PaymentWebhookReceipt"("paymentId", "createdAt");

CREATE TABLE "PaymentReconciliationCase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReconciliationCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentReconciliationCase_paymentId_reason_key" ON "PaymentReconciliationCase"("paymentId", "reason");

CREATE TABLE "PaymentOutboxEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentOutboxEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentOutboxEvent_paymentId_eventType_key" ON "PaymentOutboxEvent"("paymentId", "eventType");
CREATE INDEX "PaymentOutboxEvent_processedAt_createdAt_idx" ON "PaymentOutboxEvent"("processedAt", "createdAt");
