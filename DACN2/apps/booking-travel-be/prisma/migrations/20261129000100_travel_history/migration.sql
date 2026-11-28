ALTER TABLE "User" ADD COLUMN "travelHistoryEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "HotelSearchHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fingerprint" VARCHAR(64) NOT NULL,
  "criteria" JSONB NOT NULL,
  "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "HotelSearchHistory_userId_fingerprint_key" ON "HotelSearchHistory"("userId", "fingerprint");
CREATE INDEX "HotelSearchHistory_userId_searchedAt_id_idx" ON "HotelSearchHistory"("userId", "searchedAt" DESC, "id" DESC);

CREATE TABLE "HotelViewHistory" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "viewCount" INTEGER NOT NULL DEFAULT 1,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "hotelId")
);
CREATE INDEX "HotelViewHistory_userId_viewedAt_hotelId_idx" ON "HotelViewHistory"("userId", "viewedAt" DESC, "hotelId" DESC);
CREATE INDEX "HotelViewHistory_hotelId_idx" ON "HotelViewHistory"("hotelId");
