-- CreateEnum
CREATE TYPE "Role" AS ENUM ('mentee', 'mentor', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('pending', 'accepted', 'declined', 'ended');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'under_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('draft', 'in_review', 'published', 'archived');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('breathing', 'mindfulness', 'movement', 'audio', 'routine', 'awareness');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('verify_email', 'reset_password');

-- CreateTable
CREATE TABLE "USER" (
    "user_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'mentee',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "USER_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "MENTOR_PROFILE" (
    "mentor_profile_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "bio" TEXT NOT NULL,
    "expertise_summary" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verification_doc_key" TEXT NOT NULL,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "MENTOR_PROFILE_pkey" PRIMARY KEY ("mentor_profile_id")
);

-- CreateTable
CREATE TABLE "MATCH_REQUEST" (
    "match_id" SERIAL NOT NULL,
    "mentee_id" INTEGER NOT NULL,
    "mentor_id" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "ended_by" INTEGER,

    CONSTRAINT "MATCH_REQUEST_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "MESSAGE" (
    "message_id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MESSAGE_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "REPORT" (
    "report_id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "reported_by" INTEGER NOT NULL,
    "assigned_moderator_id" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "REPORT_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "RESOURCE" (
    "resource_id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "time_band" TEXT NOT NULL,
    "energy_level" "Level" NOT NULL,
    "sensory_intensity" "Level" NOT NULL,
    "category" "ResourceCategory" NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),

    CONSTRAINT "RESOURCE_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "SAVED_RESOURCE" (
    "user_id" INTEGER NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SAVED_RESOURCE_pkey" PRIMARY KEY ("user_id","resource_id")
);

-- CreateTable
CREATE TABLE "AUDIT_LOG" (
    "audit_id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AUDIT_LOG_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "OTP_TOKEN" (
    "otp_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTP_TOKEN_pkey" PRIMARY KEY ("otp_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "USER_email_key" ON "USER"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MENTOR_PROFILE_user_id_key" ON "MENTOR_PROFILE"("user_id");

-- AddForeignKey
ALTER TABLE "MENTOR_PROFILE" ADD CONSTRAINT "MENTOR_PROFILE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MENTOR_PROFILE" ADD CONSTRAINT "MENTOR_PROFILE_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "USER"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MATCH_REQUEST" ADD CONSTRAINT "MATCH_REQUEST_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MATCH_REQUEST" ADD CONSTRAINT "MATCH_REQUEST_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MATCH_REQUEST" ADD CONSTRAINT "MATCH_REQUEST_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "USER"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESSAGE" ADD CONSTRAINT "MESSAGE_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "MATCH_REQUEST"("match_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESSAGE" ADD CONSTRAINT "MESSAGE_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REPORT" ADD CONSTRAINT "REPORT_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "MESSAGE"("message_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REPORT" ADD CONSTRAINT "REPORT_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REPORT" ADD CONSTRAINT "REPORT_assigned_moderator_id_fkey" FOREIGN KEY ("assigned_moderator_id") REFERENCES "USER"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESOURCE" ADD CONSTRAINT "RESOURCE_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RESOURCE" ADD CONSTRAINT "RESOURCE_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "USER"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAVED_RESOURCE" ADD CONSTRAINT "SAVED_RESOURCE_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SAVED_RESOURCE" ADD CONSTRAINT "SAVED_RESOURCE_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "RESOURCE"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AUDIT_LOG" ADD CONSTRAINT "AUDIT_LOG_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "USER"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTP_TOKEN" ADD CONSTRAINT "OTP_TOKEN_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "USER"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
