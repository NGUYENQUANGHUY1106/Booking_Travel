ALTER TABLE "Room"
  ADD COLUMN "classCode" TEXT,
  ADD COLUMN "viewCode" TEXT,
  ADD COLUMN "bedConfigurations" JSONB,
  ADD COLUMN "areaM2" DECIMAL(7,2);

CREATE INDEX "Room_hotelId_type_active_idx" ON "Room"("hotelId", "type") WHERE "deletedAt" IS NULL;

ALTER TABLE "HotelMedia" ADD COLUMN "roomId" TEXT;
CREATE INDEX "HotelMedia_roomId_status_sortOrder_idx" ON "HotelMedia"("roomId", "status", "sortOrder");
ALTER TABLE "HotelMedia" ADD CONSTRAINT "HotelMedia_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
