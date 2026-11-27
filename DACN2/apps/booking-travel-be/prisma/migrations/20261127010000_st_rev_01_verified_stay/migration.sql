ALTER TABLE "Hotel"
ADD COLUMN "reviewRatingSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Review" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 10),
  "cleanliness" INTEGER NOT NULL CHECK ("cleanliness" BETWEEN 1 AND 10),
  "location" INTEGER NOT NULL CHECK ("location" BETWEEN 1 AND 10),
  "service" INTEGER NOT NULL CHECK ("service" BETWEEN 1 AND 10),
  "facilities" INTEGER NOT NULL CHECK ("facilities" BETWEEN 1 AND 10),
  "comfort" INTEGER NOT NULL CHECK ("comfort" BETWEEN 1 AND 10),
  "value" INTEGER NOT NULL CHECK ("value" BETWEEN 1 AND 10),
  "comment" VARCHAR(2000) NOT NULL,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE INDEX "Review_hotelId_createdAt_id_idx" ON "Review"("hotelId", "createdAt", "id");
CREATE INDEX "Review_userId_createdAt_id_idx" ON "Review"("userId", "createdAt", "id");
