-- Trip Tracker Database Schema
-- Project: TripTracker (qdilvhwdddjawnyvrhlj)
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MULTI-TENANCY TABLES
-- ============================================

-- Tenants table (one per account)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant users (links Supabase auth users to tenants, supports teams of 1-2 drivers)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'driver' CHECK (role IN ('owner', 'driver')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Helper function to get tenant_id for current user
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- SETUP/CONFIGURATION TABLES
-- ============================================

-- Settings (app-level defaults, one row per tenant)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_name TEXT,
  default_currency TEXT DEFAULT 'USD' CHECK (default_currency IN ('USD', 'CAD')),
  default_fuel_unit TEXT DEFAULT 'gallons' CHECK (default_fuel_unit IN ('gallons', 'liters')),
  rate_per_mile_loaded NUMERIC,
  rate_per_mile_empty NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Charge codes (user-definable revenue/surcharge codes)
CREATE TABLE charge_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('flat', 'per_mile')),
  amount NUMERIC NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Trucks (supports multiple trucks, owned or leased)
CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  truck_number TEXT NOT NULL,
  ownership_type TEXT NOT NULL CHECK (ownership_type IN ('owned', 'leased')),
  purchase_date DATE,
  -- Owned truck fields
  purchase_price NUMERIC,
  amortization_period NUMERIC,
  residual_value NUMERIC,
  -- Leased truck fields
  lease_monthly_rate NUMERIC,
  lease_years NUMERIC,
  lease_buyoff NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, truck_number)
);

-- Locations (common/reusable locations)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quick_code TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, quick_code)
);

-- Vendors (repair/service vendors)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense types (user-definable miscellaneous expense categories)
CREATE TABLE expense_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Repair types (user-definable codes for repair line items)
CREATE TABLE repair_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ============================================
-- TRIP TABLES
-- ============================================

-- Trips (full denormalized addresses -- location_id is optional reference)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_reference TEXT,
  date DATE NOT NULL,
  expected_mileage NUMERIC,
  actual_mileage NUMERIC,
  -- Origin (denormalized)
  origin_location_id UUID REFERENCES locations(id),
  origin_name TEXT,
  origin_address1 TEXT,
  origin_address2 TEXT,
  origin_city TEXT,
  origin_state TEXT,
  origin_zip TEXT,
  -- Destination (denormalized)
  destination_location_id UUID REFERENCES locations(id),
  destination_name TEXT,
  destination_address1 TEXT,
  destination_address2 TEXT,
  destination_city TEXT,
  destination_state TEXT,
  destination_zip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stops (full denormalized address -- location_id is optional reference)
CREATE TABLE stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  location_id UUID REFERENCES locations(id),
  name TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  odometer_reading NUMERIC,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legs (full denormalized addresses -- location_ids are optional references)
CREATE TABLE legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,
  -- Start location (denormalized)
  start_location_id UUID REFERENCES locations(id),
  start_name TEXT,
  start_address1 TEXT,
  start_address2 TEXT,
  start_city TEXT,
  start_state TEXT,
  start_zip TEXT,
  -- End location (denormalized)
  end_location_id UUID REFERENCES locations(id),
  end_name TEXT,
  end_address1 TEXT,
  end_address2 TEXT,
  end_city TEXT,
  end_state TEXT,
  end_zip TEXT,
  calculated_mileage NUMERIC,
  actual_mileage NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EXPENSE TABLES
-- ============================================

-- Fuel purchases (dedicated table for fuel -- the most common expense)
CREATE TABLE fuel_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  description TEXT,
  odometer_reading NUMERIC,
  gallons NUMERIC,
  price_per_gallon NUMERIC,
  amount NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Misc expenses (all non-fuel expenses)
CREATE TABLE misc_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  expense_type_id UUID REFERENCES expense_types(id),
  type TEXT,
  description TEXT,
  date DATE NOT NULL,
  odometer_reading NUMERIC,
  amount NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- REPAIR TABLES
-- ============================================

-- Repair orders (header record for a repair)
CREATE TABLE repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES trucks(id),
  vendor_id UUID REFERENCES vendors(id),
  date DATE NOT NULL,
  description TEXT,
  odometer_reading NUMERIC,
  total NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repair order details (line items on a repair order)
CREATE TABLE repair_order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  repair_type_id UUID REFERENCES repair_types(id),
  type TEXT,
  description TEXT,
  date DATE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_trips_tenant_id ON trips(tenant_id);
CREATE INDEX idx_trips_date ON trips(date);
CREATE INDEX idx_stops_trip_id ON stops(trip_id);
CREATE INDEX idx_stops_tenant_id ON stops(tenant_id);
CREATE INDEX idx_legs_trip_id ON legs(trip_id);
CREATE INDEX idx_legs_tenant_id ON legs(tenant_id);
CREATE INDEX idx_fuel_purchases_tenant_id ON fuel_purchases(tenant_id);
CREATE INDEX idx_fuel_purchases_trip_id ON fuel_purchases(trip_id);
CREATE INDEX idx_misc_expenses_tenant_id ON misc_expenses(tenant_id);
CREATE INDEX idx_misc_expenses_trip_id ON misc_expenses(trip_id);
CREATE INDEX idx_repair_orders_tenant_id ON repair_orders(tenant_id);
CREATE INDEX idx_repair_order_details_repair_order_id ON repair_order_details(repair_order_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_order_details ENABLE ROW LEVEL SECURITY;

-- Tenant users: users can only see their own row
CREATE POLICY "Users can view own tenant_user record"
  ON tenant_users FOR SELECT
  USING (user_id = auth.uid());

-- All other tables: users can only access data for their tenant
CREATE POLICY "Users can access own tenant data"
  ON tenants FOR ALL
  USING (id = get_tenant_id());

CREATE POLICY "Users can access own settings"
  ON settings FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own charge_codes"
  ON charge_codes FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own trucks"
  ON trucks FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own locations"
  ON locations FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own vendors"
  ON vendors FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own expense_types"
  ON expense_types FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own repair_types"
  ON repair_types FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own trips"
  ON trips FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own stops"
  ON stops FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own legs"
  ON legs FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own fuel_purchases"
  ON fuel_purchases FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own misc_expenses"
  ON misc_expenses FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own repair_orders"
  ON repair_orders FOR ALL
  USING (tenant_id = get_tenant_id());

CREATE POLICY "Users can access own repair_order_details"
  ON repair_order_details FOR ALL
  USING (tenant_id = get_tenant_id());

-- ============================================
-- TRIGGER: Auto-create tenant on user signup
-- ============================================

-- Function to create tenant and link user on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Create a new tenant
  INSERT INTO tenants (name)
  VALUES ('Account ' || NEW.id::text)
  RETURNING id INTO new_tenant_id;
  
  -- Link user to tenant as owner
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');
  
  -- Create default settings row
  INSERT INTO settings (tenant_id)
  VALUES (new_tenant_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
