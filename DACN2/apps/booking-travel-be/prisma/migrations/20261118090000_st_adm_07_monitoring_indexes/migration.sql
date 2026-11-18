CREATE INDEX "Payment_provider_status_createdAt_id_idx" ON "Payment"("provider", "status", "createdAt", "id");
CREATE INDEX "RefundRequest_provider_status_createdAt_id_idx" ON "RefundRequest"("provider", "status", "createdAt", "id");
CREATE INDEX "PaymentReconciliationCase_status_createdAt_id_idx" ON "PaymentReconciliationCase"("status", "createdAt", "id");
