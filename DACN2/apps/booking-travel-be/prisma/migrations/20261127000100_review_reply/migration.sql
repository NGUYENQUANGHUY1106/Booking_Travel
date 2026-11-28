DO $$ BEGIN
IF to_regclass('"Review"') IS NULL THEN
CREATE TABLE "Review" (
  "id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "hotelId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL, "rating" INTEGER NOT NULL,
  "title" VARCHAR(120), "content" VARCHAR(2000) NOT NULL,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 10)
);
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE INDEX "Review_hotelId_isVisible_createdAt_id_idx" ON "Review"("hotelId", "isVisible", "createdAt", "id");
CREATE INDEX "Review_authorId_createdAt_idx" ON "Review"("authorId", "createdAt");
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;

CREATE TABLE "ReviewReply" (
  "id" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  "content" VARCHAR(2000) NOT NULL, "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewReply_reviewId_key" ON "ReviewReply"("reviewId");
CREATE INDEX "ReviewReply_authorId_createdAt_idx" ON "ReviewReply"("authorId", "createdAt");
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
