-- Seed test locations
-- Run this in Supabase SQL Editor
-- Make sure you've already run schema-geocoding.sql first

-- This grabs your tenant_id automatically (assumes single tenant)
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM tenants LIMIT 1;

  INSERT INTO locations (tenant_id, name, address1, city, state, zip_code) VALUES
    (tid, 'Mississauga Industries',  '6900 Millcreek Dr',            'Mississauga', 'ON', 'L5N 6B4'),
    (tid, 'Toronto Warehousing',     '45 Villiers St',               'Toronto',     'ON', 'M5A 1A9'),
    (tid, 'Montreal Industries',     '8000 Rue George',              'Montreal',    'QC', 'H1Z 4J2'),
    (tid, 'Chicago Distribution',    '2300 S Lumber St',             'Chicago',     'IL', '60616'),
    (tid, 'New Jersey Logistics',    '400 Delancy St',               'Newark',      'NJ', '07105'),
    (tid, 'Buffalo Freight Terminal', '100 Lee St',                   'Buffalo',     'NY', '14210'),
    (tid, 'Texas Hub Shipping',      '4500 Frye Rd',                 'Baytown',     'TX', '77521'),
    (tid, 'Whitby Cold Storage',     '1801 Hopkins St',              'Whitby',      'ON', 'L1N 2C3');
END $$;
