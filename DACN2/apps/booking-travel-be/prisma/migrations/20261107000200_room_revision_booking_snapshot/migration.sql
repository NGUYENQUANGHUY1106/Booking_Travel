ALTER TABLE "Room" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Booking"
  ADD COLUMN "roomNameSnapshot" TEXT,
  ADD COLUMN "roomTypeSnapshot" TEXT;

UPDATE "Booking" AS booking
SET "roomNameSnapshot" = room."name",
    "roomTypeSnapshot" = room."type"
FROM "Room" AS room
WHERE booking."roomId" = room."id";

ALTER TABLE "Booking"
  ALTER COLUMN "roomNameSnapshot" SET NOT NULL,
  ALTER COLUMN "roomTypeSnapshot" SET NOT NULL;
