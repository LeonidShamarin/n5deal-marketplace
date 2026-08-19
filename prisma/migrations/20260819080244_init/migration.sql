-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('PAYMENTS', 'FINTECH', 'CRYPTO', 'BANKING', 'EMONEY', 'FOREX', 'LENDING', 'GAMBLING');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('MSO', 'SEMI', 'EMI', 'PI', 'API_LICENSE', 'BANK', 'VASP', 'MTL');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'LICENSE_ONLY');

-- CreateEnum
CREATE TYPE "AssetBenefit" AS ENUM ('IBAN', 'SWIFT', 'SEPA', 'ACQUIRING', 'CARD_ISSUING', 'STAFF', 'SOFTWARE', 'CLIENT_BASE', 'BANK_ACCOUNTS', 'OFFICE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'MANAGER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BuyerVisibility" AS ENUM ('PUBLIC', 'VERIFIED_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('USER', 'ASSET');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('SUSPEND', 'UNSUSPEND', 'REMOVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "about" TEXT,
    "website" TEXT,
    "country" CHAR(2) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "about" TEXT,
    "thesis" TEXT NOT NULL,
    "targetCategories" "BusinessCategory"[],
    "targetCountries" TEXT[],
    "targetLicenseTypes" "LicenseType"[],
    "ticketMin" INTEGER,
    "ticketMax" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "needsActiveLicense" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "BuyerVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ref" SERIAL NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BusinessCategory" NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "country" CHAR(2) NOT NULL,
    "regulator" TEXT,
    "businessStatus" "BusinessStatus" NOT NULL,
    "benefits" "AssetBenefit"[],
    "askingPrice" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "employees" INTEGER,
    "yearOfIssue" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "previousStatus" "AssetStatus",
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "assetId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "targetUserId" TEXT,
    "targetAssetId" TEXT,
    "reason" TEXT NOT NULL,
    "previousStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SellerProfile_userId_key" ON "SellerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_userId_key" ON "BuyerProfile"("userId");

-- CreateIndex
CREATE INDEX "BuyerProfile_visibility_idx" ON "BuyerProfile"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_ref_key" ON "Asset"("ref");

-- CreateIndex
CREATE INDEX "Asset_status_category_idx" ON "Asset"("status", "category");

-- CreateIndex
CREATE INDEX "Asset_status_country_idx" ON "Asset"("status", "country");

-- CreateIndex
CREATE INDEX "Asset_sellerId_status_idx" ON "Asset"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Asset_askingPrice_idx" ON "Asset"("askingPrice");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_key_key" ON "Thread"("key");

-- CreateIndex
CREATE INDEX "Thread_buyerId_lastMessageAt_idx" ON "Thread"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Thread_sellerId_lastMessageAt_idx" ON "Thread"("sellerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_targetType_createdAt_idx" ON "ModerationEvent"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_actorId_createdAt_idx" ON "ModerationEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "ModerationEvent_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
