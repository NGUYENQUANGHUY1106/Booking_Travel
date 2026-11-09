DROP INDEX IF EXISTS "HotelMedia_one_cover_per_hotel";

CREATE UNIQUE INDEX "HotelMedia_one_cover_per_hotel"
  ON "HotelMedia"("hotelId")
  WHERE "roomId" IS NULL AND "isCover" = true
    AND "deletedAt" IS NULL AND "status" = 'READY';

CREATE UNIQUE INDEX "HotelMedia_one_cover_per_room"
  ON "HotelMedia"("roomId")
  WHERE "roomId" IS NOT NULL AND "isCover" = true
    AND "deletedAt" IS NULL AND "status" = 'READY';
