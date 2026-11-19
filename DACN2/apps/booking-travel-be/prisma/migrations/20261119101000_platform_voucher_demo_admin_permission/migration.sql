UPDATE "AdminProfile"
SET "permissions" = array_append("permissions", 'PROMOTION_MANAGEMENT')
WHERE "userId" = 'seed-user-admin'
  AND NOT ('PROMOTION_MANAGEMENT' = ANY("permissions"));
