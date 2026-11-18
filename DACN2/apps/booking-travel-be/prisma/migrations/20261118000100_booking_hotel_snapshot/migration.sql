ALTER TABLE "Booking"
  ADD COLUMN "hotelNameSnapshot" TEXT,
  ADD COLUMN "hotelAddressSnapshot" TEXT;

UPDATE "Booking" AS booking
SET "hotelNameSnapshot" = hotel."name",
    "hotelAddressSnapshot" = concat_ws(', ',
      NULLIF(hotel."addressLine", ''),
      NULLIF(hotel."ward", ''),
      NULLIF(hotel."district", ''),
      NULLIF(hotel."city", ''),
      NULLIF(hotel."province", '')
    )
FROM "Hotel" AS hotel
WHERE booking."hotelId" = hotel."id";

ALTER TABLE "Booking"
  ALTER COLUMN "hotelNameSnapshot" SET NOT NULL,
  ALTER COLUMN "hotelAddressSnapshot" SET NOT NULL;
