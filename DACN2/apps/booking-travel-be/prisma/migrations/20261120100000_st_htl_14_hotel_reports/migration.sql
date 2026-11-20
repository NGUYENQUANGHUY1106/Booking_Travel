CREATE TYPE "HotelReportReason" AS ENUM (
  'INCORRECT_INFORMATION',
  'MISLEADING_IMAGES',
  'FRAUD',
  'SAFETY',
  'OTHER'
);

CREATE TYPE "HotelReportStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED'
);

CREATE TABLE "HotelReport" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "HotelReportReason" NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "evidenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "HotelReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HotelReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelReport_bookingId_key" ON "HotelReport"("bookingId");
CREATE INDEX "HotelReport_status_createdAt_idx" ON "HotelReport"("status", "createdAt");
CREATE INDEX "HotelReport_hotelId_createdAt_idx" ON "HotelReport"("hotelId", "createdAt");
CREATE INDEX "HotelReport_reporterId_createdAt_idx" ON "HotelReport"("reporterId", "createdAt");

ALTER TABLE "HotelReport"
  ADD CONSTRAINT "HotelReport_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HotelReport"
  ADD CONSTRAINT "HotelReport_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HotelReport"
  ADD CONSTRAINT "HotelReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
