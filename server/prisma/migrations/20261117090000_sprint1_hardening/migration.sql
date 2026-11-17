-- OTP brute-force protection: count wrong guesses per code
ALTER TABLE "OTP_TOKEN" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Mentor review: store the admin's reason; supporting document is optional (SRS FR3.1)
ALTER TABLE "MENTOR_PROFILE" ADD COLUMN "review_reason" TEXT;
ALTER TABLE "MENTOR_PROFILE" ALTER COLUMN "verification_doc_key" DROP NOT NULL;
