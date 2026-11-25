CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "HotelEmbeddingState" (
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "model" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL CHECK ("dimensions" = 1536),
  "sourceVersion" INTEGER NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('INDEXING','READY','FAILED','BLOCKED')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "indexedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("hotelId", "model")
);
CREATE INDEX "HotelEmbeddingState_status_updatedAt_idx" ON "HotelEmbeddingState"("status", "updatedAt");

CREATE TABLE "HotelEmbeddingChunk" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "sourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "chunkSchema" INTEGER NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "language" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL CHECK ("dimensions" = 1536),
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelEmbeddingChunk_unique_source" UNIQUE ("hotelId","model","sourceVersion","sourceType","resourceId","chunkIndex")
);
CREATE INDEX "HotelEmbeddingChunk_hotel_model_version_idx" ON "HotelEmbeddingChunk"("hotelId", "model", "sourceVersion");
-- Exact nearest-neighbour search initially: ANN indexes need measured recall under visibility filtering.
