CREATE INDEX "Conversation_hotelId_userId_idx" ON "Conversation"("hotelId", "userId");
CREATE INDEX "Booking_hotelId_userId_createdAt_id_idx" ON "Booking"("hotelId", "userId", "createdAt", "id");
