CREATE TYPE "StayReminderKind" AS ENUM (
    'CHECK_IN_24H',
    'CHECK_IN_2H',
    'CHECK_OUT_24H',
    'CHECK_OUT_2H'
);

CREATE TABLE "StayReminder" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "StayReminderKind" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StayReminder_bookingId_kind_key" ON "StayReminder"("bookingId", "kind");
CREATE INDEX "StayReminder_userId_scheduledAt_idx" ON "StayReminder"("userId", "scheduledAt");
CREATE INDEX "StayReminder_sentAt_scheduledAt_idx" ON "StayReminder"("sentAt", "scheduledAt");

ALTER TABLE "StayReminder" ADD CONSTRAINT "StayReminder_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StayReminder" ADD CONSTRAINT "StayReminder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
