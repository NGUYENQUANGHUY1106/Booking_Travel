CREATE INDEX IF NOT EXISTS "Payment_status_succeededAt_bookingId_idx"
ON "Payment" (status, "succeededAt", "bookingId") WHERE "succeededAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "RefundRequest_status_completedAt_bookingId_idx"
ON "RefundRequest" (status, "completedAt", "bookingId") WHERE "completedAt" IS NOT NULL;
