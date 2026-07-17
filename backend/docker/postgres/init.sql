-- Bean & Brew Coffee Shop Database Initialization
-- This script runs automatically when PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom enum types (if not exist)
DO $$ BEGIN
    CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEOUT', 'DELIVERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'BARISTA', 'MANAGER', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS', 'PAYMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UnitType" AS ENUM ('PIECE', 'KG', 'GRAM', 'LITER', 'ML', 'BOX', 'PACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InventoryStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TableStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OtpType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PHONE_VERIFICATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Bean & Brew Database initialized successfully';
END $$;
