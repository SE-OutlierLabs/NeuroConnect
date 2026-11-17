import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neuroconnect.local' },
    update: {},
    create: {
      email: 'admin@neuroconnect.local',
      password_hash: passwordHash,
      display_name: 'Admin Lead',
      role: 'admin',
      email_verified: true,
    },
  });

  // 2. Approved Mentor
  const mentor1 = await prisma.user.upsert({
    where: { email: 'mentor.approved@neuroconnect.local' },
    update: {},
    create: {
      email: 'mentor.approved@neuroconnect.local',
      password_hash: passwordHash,
      display_name: 'Ayesha K.',
      role: 'mentor',
      email_verified: true,
      mentor_profile: {
        create: {
          bio: 'Software engineer living with adult ADHD. Happy to share low-friction focus routines and workplace communication strategies.',
          expertise_summary: 'ADHD time-blindness, body doubling, tech workplace accommodations',
          verification_status: 'approved',
          verification_doc_key: 's3://neuroconnect-docs/ayesha-verification.pdf',
          reviewed_by: admin.user_id,
          reviewed_at: new Date(),
        },
      },
    },
  });

  // 3. Pending Mentor (for testing Admin Approval)
  await prisma.user.upsert({
    where: { email: 'mentor.pending@neuroconnect.local' },
    update: {},
    create: {
      email: 'mentor.pending@neuroconnect.local',
      password_hash: passwordHash,
      display_name: 'Bilal M.',
      role: 'mentor', // registered as a mentor; application is still pending
      email_verified: true,
      mentor_profile: {
        create: {
          bio: 'Late-diagnosed autistic adult and UX researcher offering calm peer guidance on sensory burnout.',
          expertise_summary: 'Autism sensory overload, energy pacing, university transitions',
          verification_status: 'pending',
          verification_doc_key: 's3://neuroconnect-docs/bilal-verification.pdf',
        },
      },
    },
  });

  // 4. Verified Mentee
  await prisma.user.upsert({
    where: { email: 'mentee@neuroconnect.local' },
    update: {},
    create: {
      email: 'mentee@neuroconnect.local',
      password_hash: passwordHash,
      display_name: 'Zainab R.',
      role: 'mentee',
      email_verified: true,
    },
  });

  console.log('Seed complete. Password for all accounts: Password123!');
  console.log({ admin: admin.email, approvedMentor: mentor1.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());