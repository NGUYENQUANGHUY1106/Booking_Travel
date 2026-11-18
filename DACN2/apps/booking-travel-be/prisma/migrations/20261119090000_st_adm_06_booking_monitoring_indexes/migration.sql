CREATE INDEX "Booking_createdAt_id_idx" ON "Booking"("createdAt", "id");
CREATE INDEX "Booking_status_createdAt_id_idx" ON "Booking"("status", "createdAt", "id");
CREATE INDEX "Booking_checkIn_createdAt_id_idx" ON "Booking"("checkIn", "createdAt", "id");
CREATE INDEX "Booking_checkOut_createdAt_id_idx" ON "Booking"("checkOut", "createdAt", "id");
