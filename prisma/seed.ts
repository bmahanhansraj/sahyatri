import 'dotenv/config';
/**
 * Demo data so the platform is explorable the moment it's deployed.
 * All demo accounts use password: demo1234
 */
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const pw = await bcrypt.hash('demo1234', 10);

  const admin = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: { phone: '9000000001', name: 'Asha Admin', passwordHash: pw, roles: ['SUPER_ADMIN', 'KYC_APPROVER', 'RIDER'] },
  });

  await prisma.user.upsert({
    where: { phone: '9000000002' },
    update: {},
    create: { phone: '9000000002', name: 'Kiran Approver', passwordHash: pw, roles: ['KYC_APPROVER', 'RIDER'] },
  });

  const driver = await prisma.user.upsert({
    where: { phone: '9000000003' },
    update: {},
    create: {
      phone: '9000000003',
      name: 'Ravi Kumar',
      passwordHash: pw,
      roles: ['NON_COMMERCIAL_DRIVER', 'RIDER'],
      kycStatus: 'APPROVED',
      gender: 'male',
    },
  });

  const commercial = await prisma.user.upsert({
    where: { phone: '9000000004' },
    update: {},
    create: {
      phone: '9000000004',
      name: 'Meena Travels',
      passwordHash: pw,
      roles: ['COMMERCIAL_DRIVER', 'RIDER'],
      kycStatus: 'APPROVED',
      gender: 'female',
    },
  });

  await prisma.user.upsert({
    where: { phone: '9000000005' },
    update: {},
    create: { phone: '9000000005', name: 'Priya Rider', passwordHash: pw, roles: ['RIDER'], gender: 'female' },
  });

  // Corporate: pre-verified employee (PRD §5.1)
  const corpOwner = await prisma.user.upsert({
    where: { phone: '9000000006' },
    update: {},
    create: { phone: '9000000006', name: 'Neel (TechCorp Admin)', passwordHash: pw, roles: ['CORPORATE_ADMIN', 'RIDER'] },
  });
  const corp = await prisma.corporateAccount.upsert({
    where: { ownerId: corpOwner.id },
    update: {},
    create: { name: 'TechCorp India', ownerId: corpOwner.id, approved: true, gstin: '29AAACT1234F1Z5' },
  });
  await prisma.user.upsert({
    where: { phone: '9000000007' },
    update: {},
    create: {
      phone: '9000000007',
      name: 'Emp Esha (TechCorp)',
      passwordHash: pw,
      roles: ['RIDER'],
      kycStatus: 'PRE_VERIFIED',
      corporateId: corp.id,
      gender: 'female',
    },
  });

  const now = Date.now();
  const at = (h: number) => new Date(now + h * 3600 * 1000);

  const existing = await prisma.ride.count();
  if (existing === 0) {
    await prisma.ride.createMany({
      data: [
        {
          listingType: 'POOL', vehicleType: 'CAR', scheduleType: 'RECURRING', status: 'PUBLISHED',
          driverId: driver.id, origin: 'HSR Layout, Bengaluru', destination: 'Electronic City Phase 1',
          distanceKm: 12, departAt: at(15), etaMinutes: 32, seatsTotal: 3, farePerSeat: 110,
          kycRequired: true, isOutstation: true,
        },
        {
          listingType: 'POOL', vehicleType: 'BIKE', scheduleType: 'ONE_TIME', status: 'PUBLISHED',
          driverId: driver.id, origin: 'Indiranagar Metro', destination: 'MG Road',
          distanceKm: 4, departAt: at(4), etaMinutes: 12, seatsTotal: 1, farePerSeat: 25,
          kycRequired: false,
        },
        {
          listingType: 'ONE_WAY', vehicleType: 'CAR', scheduleType: 'ONE_TIME', status: 'PUBLISHED',
          driverId: commercial.id, origin: 'Kempegowda Airport', destination: 'Whitefield',
          distanceKm: 41, departAt: at(20), etaMinutes: 75, seatsTotal: 4, farePerSeat: 420,
          kycRequired: true, isOutstation: true,
        },
        {
          listingType: 'POOL', vehicleType: 'CAR', scheduleType: 'ONE_TIME', status: 'PUBLISHED',
          driverId: commercial.id, origin: 'Koramangala', destination: 'Manyata Tech Park',
          distanceKm: 16, departAt: at(26), etaMinutes: 45, seatsTotal: 3, farePerSeat: 150,
          kycRequired: true, isOutstation: true, womenOnly: true,
        },
      ],
    });
  }

  await prisma.platformConfig.upsert({
    where: { key: 'quota.weekly' },
    update: {},
    create: { key: 'quota.weekly', value: { CAR: 3, BIKE: 6 } },
  });
  await prisma.platformConfig.upsert({
    where: { key: 'fee.booking' },
    update: {},
    create: { key: 'fee.booking', value: { POOL: 10, ONE_WAY: 25, BUS: 15 } },
  });

  console.log('Seeded. Demo accounts (password: demo1234):');
  console.log('  9000000001 Super Admin + KYC Approver');
  console.log('  9000000003 Non-commercial driver (KYC approved)');
  console.log('  9000000004 Commercial driver');
  console.log('  9000000005 Rider (no KYC)');
  console.log('  9000000007 Corporate rider (pre-verified)');
}

main().finally(() => prisma.$disconnect());
