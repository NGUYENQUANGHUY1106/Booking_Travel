ALTER TABLE "HotelOwnerApplication"
  ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE TABLE "HotelOwnerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelOwnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerApplicationAudit" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldStatus" "OwnerApplicationStatus" NOT NULL,
  "newStatus" "OwnerApplicationStatus" NOT NULL,
  "reason" VARCHAR(500),
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerApplicationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerApplicationNotification" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerApplicationNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelOwnerProfile_userId_key" ON "HotelOwnerProfile"("userId");
CREATE INDEX "OwnerApplicationAudit_applicationId_createdAt_idx" ON "OwnerApplicationAudit"("applicationId", "createdAt");
CREATE INDEX "OwnerApplicationAudit_actorId_createdAt_idx" ON "OwnerApplicationAudit"("actorId", "createdAt");
CREATE UNIQUE INDEX "OwnerApplicationNotification_applicationId_version_key" ON "OwnerApplicationNotification"("applicationId", "version");
CREATE INDEX "OwnerApplicationNotification_userId_createdAt_idx" ON "OwnerApplicationNotification"("userId", "createdAt");

ALTER TABLE "HotelOwnerApplication" ADD CONSTRAINT "HotelOwnerApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelOwnerProfile" ADD CONSTRAINT "HotelOwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerApplicationAudit" ADD CONSTRAINT "OwnerApplicationAudit_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HotelOwnerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerApplicationAudit" ADD CONSTRAINT "OwnerApplicationAudit_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerApplicationAudit" ADD CONSTRAINT "OwnerApplicationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerApplicationNotification" ADD CONSTRAINT "OwnerApplicationNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HotelOwnerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerApplicationNotification" ADD CONSTRAINT "OwnerApplicationNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
