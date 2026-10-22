ALTER TYPE "UserStatus" ADD VALUE 'LOCKED';

CREATE TABLE "AdminUserAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldStatus" "UserStatus" NOT NULL,
    "newStatus" "UserStatus" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUserAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminUserAudit_targetUserId_createdAt_idx" ON "AdminUserAudit"("targetUserId", "createdAt");
CREATE INDEX "AdminUserAudit_actorId_createdAt_idx" ON "AdminUserAudit"("actorId", "createdAt");
ALTER TABLE "AdminUserAudit" ADD CONSTRAINT "AdminUserAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminUserAudit" ADD CONSTRAINT "AdminUserAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
