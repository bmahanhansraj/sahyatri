-- Sahyatri bootstrap DDL (mirrors prisma/schema.prisma).
-- Normally you run `npx prisma db push` instead; this file exists so the
-- database can also be created with plain psql in restricted environments.

CREATE TYPE "Role" AS ENUM ('RIDER','NON_COMMERCIAL_DRIVER','COMMERCIAL_DRIVER','FLEET_OPERATOR','CORPORATE_ADMIN','KYC_APPROVER','CUSTOMER_SUPPORT','SUPER_ADMIN');
CREATE TYPE "VehicleType" AS ENUM ('BIKE','CAR','BUS');
CREATE TYPE "ListingType" AS ENUM ('POOL','ONE_WAY','BUS');
CREATE TYPE "RideStatus" AS ENUM ('DRAFT','PUBLISHED','PAUSED','FULL','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ScheduleType" AS ENUM ('ONE_TIME','RECURRING');
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED','PENDING','APPROVED','REJECTED','EXPIRED','PRE_VERIFIED');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED','CANCELLED','COMPLETED','REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','WALLET','UPI','CARD');
CREATE TYPE "AlertType" AS ENUM ('STATIONARY_VEHICLE','ROUTE_DEVIATION','ETA_BREACH','SPEEDING_HARSH_DRIVING','TRIP_NOT_STARTED','SOS');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN','DRIVER_CONFIRMED_SAFE','ESCALATED','RESOLVED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roles" "Role"[] DEFAULT ARRAY['RIDER']::"Role"[],
  "gender" TEXT,
  "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "kycExpiresAt" TIMESTAMP(3),
  "isSuspended" BOOLEAN NOT NULL DEFAULT false,
  "safetyScore" INTEGER NOT NULL DEFAULT 100,
  "reliabilityScore" INTEGER NOT NULL DEFAULT 100,
  "corporateId" TEXT,
  "fleetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "FleetOperatorAccount" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FleetOperatorAccount_ownerId_key" ON "FleetOperatorAccount"("ownerId");

CREATE TABLE "CorporateAccount" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "gstin" TEXT,
  "ownerId" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "busKycRequired" BOOLEAN NOT NULL DEFAULT false,
  "nightRideCutoffHour" INTEGER,
  "perEmployeeCostCap" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CorporateAccount_ownerId_key" ON "CorporateAccount"("ownerId");

CREATE TABLE "Vehicle" (
  "id" TEXT PRIMARY KEY,
  "type" "VehicleType" NOT NULL,
  "regNumber" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "ownerId" TEXT,
  "fleetId" TEXT,
  "seatLayout" JSONB,
  "insuranceExpiry" TIMESTAMP(3),
  "permitExpiry" TIMESTAMP(3),
  "fitnessExpiry" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Vehicle_regNumber_key" ON "Vehicle"("regNumber");

CREATE TABLE "Ride" (
  "id" TEXT PRIMARY KEY,
  "listingType" "ListingType" NOT NULL,
  "vehicleType" "VehicleType" NOT NULL,
  "scheduleType" "ScheduleType" NOT NULL DEFAULT 'ONE_TIME',
  "status" "RideStatus" NOT NULL DEFAULT 'DRAFT',
  "driverId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "waypoints" JSONB,
  "originLat" DOUBLE PRECISION,
  "originLng" DOUBLE PRECISION,
  "destLat" DOUBLE PRECISION,
  "destLng" DOUBLE PRECISION,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "departAt" TIMESTAMP(3) NOT NULL,
  "etaMinutes" INTEGER,
  "seatsTotal" INTEGER NOT NULL,
  "seatsBooked" INTEGER NOT NULL DEFAULT 0,
  "farePerSeat" DOUBLE PRECISION NOT NULL,
  "womenOnly" BOOLEAN NOT NULL DEFAULT false,
  "kycRequired" BOOLEAN NOT NULL DEFAULT false,
  "isOutstation" BOOLEAN NOT NULL DEFAULT false,
  "clonedFromId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Ride_status_departAt_idx" ON "Ride"("status", "departAt");
CREATE INDEX "Ride_driverId_scheduleType_createdAt_idx" ON "Ride"("driverId", "scheduleType", "createdAt");

CREATE TABLE "Booking" (
  "id" TEXT PRIMARY KEY,
  "rideId" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "seats" INTEGER NOT NULL DEFAULT 1,
  "seatNumbers" JSONB,
  "fareTotal" DOUBLE PRECISION NOT NULL,
  "bookingFee" DOUBLE PRECISION NOT NULL,
  "gstOnFee" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "kycBypassLogged" BOOLEAN NOT NULL DEFAULT false,
  "qrCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Booking_riderId_createdAt_idx" ON "Booking"("riderId", "createdAt");

CREATE TABLE "KycSubmission" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentRef" TEXT NOT NULL,
  "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3)
);
CREATE INDEX "KycSubmission_status_createdAt_idx" ON "KycSubmission"("status", "createdAt");

CREATE TABLE "WalletTransaction" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "bookingId" TEXT,
  "gatewayRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SafetyAlert" (
  "id" TEXT PRIMARY KEY,
  "rideId" TEXT NOT NULL,
  "type" "AlertType" NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "SafetyAlert_status_createdAt_idx" ON "SafetyAlert"("status", "createdAt");

CREATE TABLE "Rating" (
  "id" TEXT PRIMARY KEY,
  "fromId" TEXT NOT NULL,
  "toId" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Rating_fromId_toId_rideId_key" ON "Rating"("fromId", "toId", "rideId");

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

CREATE TABLE "PlatformConfig" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "FleetOperatorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FleetOperatorAccount" ADD CONSTRAINT "FleetOperatorAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorporateAccount" ADD CONSTRAINT "CorporateAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "FleetOperatorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
