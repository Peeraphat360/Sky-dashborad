-- 0002_restructure_slots_34.sql
-- Restructures parking capacity from 60 → 34 slots across new zone layout:
--   Zone A1 (frontend): A-001          →  1 Supercar slot
--   Zone A2 (frontend): A-002 – A-008  →  7 Sedan/EV slots
--   Zone B:             B-001 – B-010  → 10 Standard Sedan slots
--   Zone C:             C-001 – C-016  → 16 Van/Pickup/High-Top Cargo slots
--
-- WARNING: On a production system with live bookings, cancel or migrate
-- active bookings before running this migration to avoid FK violations.
-- The UPDATE below detaches all booking rows from their slots as a safety net
-- for dev/staging environments.

-- Step 1: Detach bookings from slots that are about to be deleted
UPDATE bookings
SET slot_id = (SELECT id FROM parking_slots LIMIT 1)
WHERE slot_id IN (SELECT id FROM parking_slots);

-- Step 2: Remove existing slots and zones (FK order: slots first)
DELETE FROM parking_slots;
DELETE FROM parking_zones;

-- Step 3: Re-insert three zones and 34 slots in a single CTE pass
WITH inserted_zones AS (
  INSERT INTO parking_zones (name, floor) VALUES
    ('A', 1),
    ('B', 1),
    ('C', 2)
  RETURNING id, name
),
zone_a AS (SELECT id AS zone_id FROM inserted_zones WHERE name = 'A'),
zone_b AS (SELECT id AS zone_id FROM inserted_zones WHERE name = 'B'),
zone_c AS (SELECT id AS zone_id FROM inserted_zones WHERE name = 'C'),
slots_a AS (
  SELECT
    'A-' || LPAD(n::text, 3, '0') AS number,
    'AVAILABLE'::slot_status       AS status,
    zone_id
  FROM zone_a, generate_series(1, 8) AS n
),
slots_b AS (
  SELECT
    'B-' || LPAD(n::text, 3, '0') AS number,
    'AVAILABLE'::slot_status       AS status,
    zone_id
  FROM zone_b, generate_series(1, 10) AS n
),
slots_c AS (
  SELECT
    'C-' || LPAD(n::text, 3, '0') AS number,
    'AVAILABLE'::slot_status       AS status,
    zone_id
  FROM zone_c, generate_series(1, 16) AS n
),
all_slots AS (
  SELECT * FROM slots_a
  UNION ALL SELECT * FROM slots_b
  UNION ALL SELECT * FROM slots_c
)
INSERT INTO parking_slots (number, status, zone_id)
SELECT number, status, zone_id FROM all_slots;

-- Verify: should return 3 rows with counts 8, 10, 16
-- SELECT pz.name, COUNT(ps.id) FROM parking_slots ps
-- JOIN parking_zones pz ON pz.id = ps.zone_id GROUP BY pz.name ORDER BY pz.name;
