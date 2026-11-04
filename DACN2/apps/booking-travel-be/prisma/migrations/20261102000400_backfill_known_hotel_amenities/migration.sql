INSERT INTO "HotelAmenity" ("hotelId", "amenityId")
SELECT hotel."id", catalog."id"
FROM "Hotel" AS hotel
CROSS JOIN LATERAL unnest(hotel."amenities") AS legacy("name")
JOIN "AmenityCatalog" AS catalog ON catalog."id" = CASE legacy."name"
  WHEN 'Wi-Fi' THEN 'WIFI'
  WHEN 'Hồ bơi' THEN 'POOL'
  WHEN 'Bữa sáng' THEN 'BREAKFAST'
  WHEN 'Bãi đỗ xe' THEN 'PARKING'
  WHEN 'Điều hòa' THEN 'AIR_CONDITIONING'
  WHEN 'Nhà hàng' THEN 'RESTAURANT'
  ELSE NULL
END
ON CONFLICT ("hotelId", "amenityId") DO NOTHING;
