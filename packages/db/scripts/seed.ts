/**
 * Seed development data.
 *
 *   pnpm db:seed
 *
 * Creates TWO gyms on purpose. GymABC is the pilot tenant; Northside is the
 * control. Every isolation test asserts that a user of one cannot see a single
 * row belonging to the other — which needs a second tenant with real data in
 * it, not an empty table.
 *
 * Runs as the OWNER, which bypasses RLS. That is correct for a seeder and
 * wrong for everything else.
 */
import { hash } from '@node-rs/argon2';
import { and, count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

const DEV_PASSWORD = 'GymX!dev2026';

/** Matches the admin app's hashing parameters exactly — see apps/admin/src/lib/password.ts. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

interface SeedUser {
  email: string;
  name: string;
  role: (typeof schema.roleEnum.enumValues)[number];
}

const GYM_ABC_USERS: SeedUser[] = [
  { email: 'manager@gymabc.test', name: 'Dimitri Rousseau', role: 'gym_manager' },
  { email: 'desk@gymabc.test', name: 'Priya Ramgoolam', role: 'staff' },
  { email: 'accounts@gymabc.test', name: 'Kevin Li Ying', role: 'accountant' },
];

const NORTHSIDE_USERS: SeedUser[] = [
  { email: 'manager@northside.test', name: 'Sandra Mootoo', role: 'gym_manager' },
  { email: 'desk@northside.test', name: 'Jean-Paul Adam', role: 'staff' },
];

async function main() {
  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });

  try {
    const passwordHash = await hash(DEV_PASSWORD, ARGON2_OPTIONS);

    // --- Gyms ------------------------------------------------------------
    const [gymAbc] = await db
      .insert(schema.gyms)
      .values({
        name: 'Gym ABC',
        slug: 'gym-abc',
        brn: 'C12345678',
        vatNumber: 'VAT20260001',
        timezone: 'Indian/Mauritius',
        currency: 'MUR',
        vatRateBp: 1500,
        locales: ['en', 'fr'],
        defaultLocale: 'en',
        minContractMonths: 12,
        overdueGraceDays: 1,
        atRiskDays: 21,
        branding: { primaryColor: '#f0483e', accentColor: '#0f766e' },
        enabledModules: ['gym-abc'],
      })
      .onConflictDoUpdate({
        target: schema.gyms.slug,
        set: { name: 'Gym ABC', updatedAt: new Date() },
      })
      .returning();

    const [northside] = await db
      .insert(schema.gyms)
      .values({
        name: 'Northside Fitness',
        slug: 'northside',
        timezone: 'Indian/Mauritius',
        currency: 'MUR',
        vatRateBp: 1500,
        locales: ['en'],
        defaultLocale: 'en',
        minContractMonths: 0,
        overdueGraceDays: 3,
        branding: { primaryColor: '#2563eb' },
        enabledModules: [],
      })
      .onConflictDoUpdate({
        target: schema.gyms.slug,
        set: { name: 'Northside Fitness', updatedAt: new Date() },
      })
      .returning();

    if (!gymAbc || !northside) throw new Error('Failed to seed gyms');
    console.log(`✓ gyms: ${gymAbc.name} (${gymAbc.id}), ${northside.name} (${northside.id})`);

    // --- Locations -------------------------------------------------------
    await seedLocation(db, gymAbc.id, 'Grand Baie', 'Royal Road, Grand Baie');
    await seedLocation(db, northside.id, 'Curepipe', 'Rue Royale, Curepipe');

    // --- Platform admin --------------------------------------------------
    const platformAdmin = await upsertUser(db, {
      email: 'admin@metabox.test',
      name: 'Metabox Platform Admin',
      passwordHash,
    });
    await db
      .insert(schema.platformAdmins)
      .values({ userId: platformAdmin.id })
      .onConflictDoNothing();
    console.log(`✓ platform admin: ${platformAdmin.email}`);

    // --- Gym users -------------------------------------------------------
    for (const [gymId, seedUsers] of [
      [gymAbc.id, GYM_ABC_USERS],
      [northside.id, NORTHSIDE_USERS],
    ] as const) {
      for (const seedUser of seedUsers) {
        const user = await upsertUser(db, {
          email: seedUser.email,
          name: seedUser.name,
          passwordHash,
        });
        await db
          .insert(schema.userRoles)
          .values({ userId: user.id, gymId, role: seedUser.role })
          .onConflictDoUpdate({
            target: [schema.userRoles.userId, schema.userRoles.gymId],
            set: { role: seedUser.role },
          });
        console.log(`  • ${seedUser.email} → ${seedUser.role}`);
      }
    }

    // --- Gym ABC plans (Phase 2) -----------------------------------------
    await seedGymAbcPlans(db, gymAbc.id);

    // --- Gym ABC members & subscriptions (Phase 1 & 3) ---------------------
    await seedGymAbcMembersAndSubscriptions(db, gymAbc.id);

    // --- A couple of audit rows, so the trail is not empty on first look --
    await db.insert(schema.auditLog).values([
      {
        gymId: gymAbc.id,
        userId: platformAdmin.id,
        actorEmail: platformAdmin.email,
        entity: 'gym',
        entityId: gymAbc.id,
        action: 'seed',
        diff: { note: 'Seeded by pnpm db:seed' },
      },
      {
        gymId: northside.id,
        userId: platformAdmin.id,
        actorEmail: platformAdmin.email,
        entity: 'gym',
        entityId: northside.id,
        action: 'seed',
        diff: { note: 'Seeded by pnpm db:seed' },
      },
    ]);

    console.log(`\n✓ seed complete. Every account's password is: ${DEV_PASSWORD}`);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

async function seedGymAbcPlans(db: SeedDb, gymId: string) {
  // Idempotent: skip if plans already exist for this gym.
  const countRows = await db
    .select({ value: count() })
    .from(schema.plans)
    .where(eq(schema.plans.gymId, gymId));
  if (Number(countRows[0]?.value ?? 0) > 0) {
    console.log('  • plans already seeded for Gym ABC, skipping');
    return;
  }

  // Full membership — gym + pool, all hours, flat_by_size pricing.
  // Solo Rs 1,000 · Couple Rs 1,800 (vs Rs 2,000 buying two solos) · Family Rs 3,500
  const [fullPlan] = await db
    .insert(schema.plans)
    .values({
      gymId,
      nameI18n: { en: 'Full Membership', fr: 'Abonnement complet' },
      descriptionI18n: { en: 'Unlimited gym and pool access.' },
      type: 'contract',
      category: 'full',
      billingInterval: 'monthly',
      basePriceCents: 100_000,
      vatInclusive: false,
      joiningFeeCents: 50_000,
      minTermMonths: 12,
      pricingModel: 'flat_by_size',
      active: true,
      sortOrder: 10,
    })
    .returning();

  if (fullPlan) {
    await db.insert(schema.planPriceTiers).values([
      { gymId, planId: fullPlan.id, sizeFrom: 2, sizeTo: 2, priceCents: 180_000 },
      { gymId, planId: fullPlan.id, sizeFrom: 3, sizeTo: null, priceCents: 350_000 },
    ]);
    await db.insert(schema.planAccessRules).values([
      { gymId, planId: fullPlan.id, area: 'gym', weekdays: null, startTime: null, endTime: null },
      { gymId, planId: fullPlan.id, area: 'pool', weekdays: null, startTime: null, endTime: null },
    ]);
  }

  // Lunch membership — gym only, 11:00–13:00 every day.
  const [lunchPlan] = await db
    .insert(schema.plans)
    .values({
      gymId,
      nameI18n: { en: 'Lunch Membership', fr: 'Abonnement midi' },
      descriptionI18n: { en: 'Gym floor access, lunch hours only (11:00–13:00).' },
      type: 'contract',
      category: 'lunch',
      billingInterval: 'monthly',
      basePriceCents: 75_000,
      vatInclusive: false,
      joiningFeeCents: 50_000,
      minTermMonths: 12,
      pricingModel: 'flat_by_size',
      active: true,
      sortOrder: 20,
    })
    .returning();

  if (lunchPlan) {
    await db.insert(schema.planPriceTiers).values([
      { gymId, planId: lunchPlan.id, sizeFrom: 2, sizeTo: 2, priceCents: 130_000 },
      { gymId, planId: lunchPlan.id, sizeFrom: 3, sizeTo: null, priceCents: 200_000 },
    ]);
    await db.insert(schema.planAccessRules).values([
      { gymId, planId: lunchPlan.id, area: 'gym', weekdays: null, startTime: '11:00', endTime: '13:00' },
    ]);
  }

  // Student membership — gym + pool, proof of enrolment required.
  const [studentPlan] = await db
    .insert(schema.plans)
    .values({
      gymId,
      nameI18n: { en: 'Student Membership', fr: 'Abonnement étudiant' },
      descriptionI18n: { en: 'Discounted rate for full-time students. Proof of enrolment required.' },
      type: 'contract',
      category: 'student',
      billingInterval: 'monthly',
      basePriceCents: 70_000,
      vatInclusive: false,
      joiningFeeCents: 0,
      minTermMonths: 12,
      pricingModel: 'flat',
      active: true,
      sortOrder: 30,
    })
    .returning();

  if (studentPlan) {
    await db.insert(schema.planAccessRules).values([
      { gymId, planId: studentPlan.id, area: 'gym', weekdays: null, startTime: null, endTime: null },
      { gymId, planId: studentPlan.id, area: 'pool', weekdays: null, startTime: null, endTime: null },
    ]);
  }

  // Day pass
  const [dayPass] = await db
    .insert(schema.plans)
    .values({
      gymId,
      nameI18n: { en: 'Day Pass', fr: 'Pass journée' },
      descriptionI18n: {},
      type: 'pass',
      category: 'solo',
      billingInterval: null,
      basePriceCents: 20_000,
      vatInclusive: false,
      joiningFeeCents: 0,
      minTermMonths: 0,
      passDurationDays: 1,
      pricingModel: 'flat',
      active: true,
      sortOrder: 40,
    })
    .returning();

  if (dayPass) {
    await db.insert(schema.planAccessRules).values([
      { gymId, planId: dayPass.id, area: 'gym', weekdays: null, startTime: null, endTime: null },
    ]);
  }

  // Week pass
  const [weekPass] = await db
    .insert(schema.plans)
    .values({
      gymId,
      nameI18n: { en: 'Week Pass', fr: 'Pass semaine' },
      descriptionI18n: {},
      type: 'pass',
      category: 'solo',
      billingInterval: null,
      basePriceCents: 70_000,
      vatInclusive: false,
      joiningFeeCents: 0,
      minTermMonths: 0,
      passDurationDays: 7,
      pricingModel: 'flat',
      active: true,
      sortOrder: 50,
    })
    .returning();

  if (weekPass) {
    await db.insert(schema.planAccessRules).values([
      { gymId, planId: weekPass.id, area: 'gym', weekdays: null, startTime: null, endTime: null },
    ]);
  }

  console.log('  • seeded 5 plans for Gym ABC (Full, Lunch, Student, Day pass, Week pass)');
}

async function seedGymAbcMembersAndSubscriptions(db: SeedDb, gymId: string) {
  // Idempotent: skip if members already exist
  const memberCount = await db
    .select({ value: count() })
    .from(schema.members)
    .where(eq(schema.members.gymId, gymId));
  if (Number(memberCount[0]?.value ?? 0) > 0) {
    console.log('  • members already seeded for Gym ABC, skipping');
    return;
  }

  // Create sample members
  const [dimitri] = await db
    .insert(schema.members)
    .values({
      gymId,
      memberSeq: 1,
      firstName: 'Dimitri',
      lastName: 'Rousseau',
      email: 'dimitri@gymabc.test',
      phone: '+230 5252 1234',
      dateOfBirth: '1988-05-12',
      gender: 'male',
      nic: 'A123456',
      locale: 'en',
      status: 'active',
      joinedAt: '2024-01-15',
    })
    .returning();

  const [priya] = await db
    .insert(schema.members)
    .values({
      gymId,
      memberSeq: 2,
      firstName: 'Priya',
      lastName: 'Ramgoolam',
      email: 'priya@gymabc.test',
      phone: '+230 5252 2345',
      dateOfBirth: '1992-08-20',
      gender: 'female',
      nic: 'B234567',
      locale: 'en',
      status: 'active',
      joinedAt: '2024-02-01',
    })
    .returning();

  const [kevin] = await db
    .insert(schema.members)
    .values({
      gymId,
      memberSeq: 3,
      firstName: 'Kevin',
      lastName: 'Li Ying',
      email: 'kevin@gymabc.test',
      phone: '+230 5252 3456',
      dateOfBirth: '1995-03-10',
      gender: 'male',
      nic: 'C345678',
      locale: 'en',
      status: 'active',
      joinedAt: '2024-01-20',
    })
    .returning();

  const [asha] = await db
    .insert(schema.members)
    .values({
      gymId,
      memberSeq: 4,
      firstName: 'Asha',
      lastName: 'Mootoo',
      email: 'asha@gymabc.test',
      phone: '+230 5252 4567',
      dateOfBirth: '1990-11-25',
      gender: 'female',
      nic: 'D456789',
      locale: 'en',
      status: 'active',
      joinedAt: '2024-02-10',
    })
    .returning();

  if (!dimitri || !priya || !kevin || !asha) {
    console.log('  • failed to seed members');
    return;
  }

  // Fetch plans for subscriptions
  const allPlans = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.gymId, gymId));

  const fullPlan = allPlans.find((p) => p.category === 'full');
  const lunchPlan = allPlans.find((p) => p.category === 'lunch');
  const studentPlan = allPlans.find((p) => p.category === 'student');

  // Create subscriptions
  if (fullPlan) {
    const [subDmitri] = await db
      .insert(schema.subscriptions)
      .values({
        gymId,
        planId: fullPlan.id,
        payerMemberId: dimitri.id,
        status: 'active',
        startsOn: '2024-01-15',
        endsOn: null,
        minTermEndsOn: '2025-01-15', // 12-month minimum
        priceCentsSnapshot: fullPlan.basePriceCents,
        vatRateBpSnapshot: 1500, // 15% VAT
        nextInvoiceOn: '2024-02-15',
      })
      .returning();

    if (subDmitri) {
      // Add Dimitri as subscription member
      await db
        .insert(schema.subscriptionMembers)
        .values({ subscriptionId: subDmitri.id, memberId: dimitri.id, gymId })
        .onConflictDoNothing();
    }
  }

  if (lunchPlan) {
    const [subPriya] = await db
      .insert(schema.subscriptions)
      .values({
        gymId,
        planId: lunchPlan.id,
        payerMemberId: priya.id,
        status: 'active',
        startsOn: '2024-02-01',
        endsOn: null,
        minTermEndsOn: '2025-02-01',
        priceCentsSnapshot: lunchPlan.basePriceCents,
        vatRateBpSnapshot: 1500,
        nextInvoiceOn: '2024-03-01',
      })
      .returning();

    if (subPriya) {
      await db
        .insert(schema.subscriptionMembers)
        .values({ subscriptionId: subPriya.id, memberId: priya.id, gymId })
        .onConflictDoNothing();
    }
  }

  if (studentPlan) {
    const [subKevin] = await db
      .insert(schema.subscriptions)
      .values({
        gymId,
        planId: studentPlan.id,
        payerMemberId: kevin.id,
        status: 'active',
        startsOn: '2024-01-20',
        endsOn: null,
        minTermEndsOn: '2025-01-20',
        priceCentsSnapshot: studentPlan.basePriceCents,
        vatRateBpSnapshot: 1500,
        nextInvoiceOn: '2024-02-20',
      })
      .returning();

    if (subKevin) {
      await db
        .insert(schema.subscriptionMembers)
        .values({ subscriptionId: subKevin.id, memberId: kevin.id, gymId })
        .onConflictDoNothing();
    }
  }

  if (fullPlan) {
    const [subAsha] = await db
      .insert(schema.subscriptions)
      .values({
        gymId,
        planId: fullPlan.id,
        payerMemberId: asha.id,
        status: 'active',
        startsOn: '2024-02-10',
        endsOn: null,
        minTermEndsOn: '2025-02-10',
        priceCentsSnapshot: fullPlan.basePriceCents,
        vatRateBpSnapshot: 1500,
        nextInvoiceOn: '2024-03-10',
      })
      .returning();

    if (subAsha) {
      await db
        .insert(schema.subscriptionMembers)
        .values({ subscriptionId: subAsha.id, memberId: asha.id, gymId })
        .onConflictDoNothing();
    }
  }

  console.log('  • seeded 4 members and 4 subscriptions for Gym ABC (Full, Lunch, Full, Student)');
}

async function seedLocation(
  db: ReturnType<typeof drizzle<typeof schema>>,
  gymId: string,
  name: string,
  address: string,
) {
  const existing = await db
    .select()
    .from(schema.locations)
    .where(and(eq(schema.locations.gymId, gymId), eq(schema.locations.name, name)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.locations).values({ gymId, name, address });
  }
}

async function upsertUser(
  db: ReturnType<typeof drizzle<typeof schema>>,
  input: { email: string; name: string; passwordHash: string },
) {
  const email = schema.normaliseEmail(input.email);

  const [user] = await db
    .insert(schema.users)
    .values({ email, name: input.name, passwordHash: input.passwordHash, locale: 'en' })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { name: input.name, passwordHash: input.passwordHash, updatedAt: new Date() },
    })
    .returning();

  if (user) return user;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (!existing) throw new Error(`Failed to upsert user ${email}`);
  return existing;
}

main().catch((error) => {
  console.error('\n✗ seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
