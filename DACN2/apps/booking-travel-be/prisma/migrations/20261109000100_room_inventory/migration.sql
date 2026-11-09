CREATE TABLE "RoomInventoryBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDateExclusive" DATE NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "RoomInventoryBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RoomInventoryBlock_dates_check" CHECK ("endDateExclusive" > "startDate"),
  CONSTRAINT "RoomInventoryBlock_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "RoomInventoryBlock_idempotencyKey_key" ON "RoomInventoryBlock"("idempotencyKey");
CREATE INDEX "RoomInventoryBlock_roomId_active_startDate_endDateExclusive_idx" ON "RoomInventoryBlock"("roomId", "active", "startDate", "endDateExclusive");
CREATE TABLE "RoomInventoryOverride" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sellableQty" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomInventoryOverride_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RoomInventoryOverride_quantity_check" CHECK ("sellableQty" >= 0)
);
CREATE UNIQUE INDEX "RoomInventoryOverride_roomId_date_key" ON "RoomInventoryOverride"("roomId", "date");
CREATE TABLE "RoomInventoryAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomInventoryAudit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoomInventoryAudit_idempotencyKey_key" ON "RoomInventoryAudit"("idempotencyKey");
CREATE INDEX "RoomInventoryAudit_hotelId_createdAt_idx" ON "RoomInventoryAudit"("hotelId", "createdAt");
