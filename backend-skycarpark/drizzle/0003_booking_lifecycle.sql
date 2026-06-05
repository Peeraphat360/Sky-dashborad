-- 0003_booking_lifecycle.sql
-- Adds a real booking lifecycle (PARKED/COMPLETED), atomic transition RPCs,
-- a CASH payment method, and enables Supabase Realtime on the relevant tables.
--
-- IMPORTANT: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block.
-- The runner executes each statement in autocommit mode and the enum ADDs run
-- before any function that references the new labels.

-- ── 1) Extend enums ────────────────────────────────────────────────────────────
ALTER TYPE "public"."booking_status"  ADD VALUE IF NOT EXISTS 'PARKED';
ALTER TYPE "public"."booking_status"  ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "public"."payment_method"  ADD VALUE IF NOT EXISTS 'CASH';

-- ── 2) Atomic transition functions (SECURITY DEFINER → bypass parking_slots RLS,
--        run in a single transaction so booking+slot never desync) ─────────────

-- 2a) Create a walk-in booking: insert CONFIRMED + reserve the slot.
--     Guards against booking a slot that is not AVAILABLE (no free slot case).
CREATE OR REPLACE FUNCTION public.create_walkin_booking(
  p_user_id           uuid,
  p_slot_id           uuid,
  p_start_time        timestamp,
  p_end_time          timestamp,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_alt_phone text,
  p_vehicle_plate     text,
  p_vehicle_province  text,
  p_vehicle_brand     text,
  p_vehicle_model     text,
  p_vehicle_type      text,
  p_fee               integer,
  p_remarks           text
) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot_status slot_status;
  v_booking public.bookings;
BEGIN
  SELECT status INTO v_slot_status FROM parking_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot_status IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;
  IF v_slot_status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  INSERT INTO bookings (
    user_id, slot_id, start_time, end_time, status,
    customer_name, customer_phone, customer_alt_phone,
    vehicle_plate, vehicle_province, vehicle_brand, vehicle_model, vehicle_type,
    fee, is_walk_in, remarks
  ) VALUES (
    p_user_id, p_slot_id, p_start_time, p_end_time, 'CONFIRMED',
    p_customer_name, p_customer_phone, p_customer_alt_phone,
    p_vehicle_plate, p_vehicle_province, p_vehicle_brand, p_vehicle_model, p_vehicle_type,
    p_fee, true, p_remarks
  ) RETURNING * INTO v_booking;

  UPDATE parking_slots SET status = 'RESERVED' WHERE id = p_slot_id;
  RETURN v_booking;
END $$;

-- 2b) Confirm an online PENDING booking → CONFIRMED + reserve slot.
CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slot uuid;
BEGIN
  SELECT slot_id INTO v_slot FROM bookings WHERE id = p_booking_id;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  UPDATE bookings SET status = 'CONFIRMED' WHERE id = p_booking_id;
  UPDATE parking_slots SET status = 'RESERVED' WHERE id = v_slot;
END $$;

-- 2c) Check in: booking → PARKED + slot → OCCUPIED.
CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slot uuid;
BEGIN
  SELECT slot_id INTO v_slot FROM bookings WHERE id = p_booking_id;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  UPDATE bookings SET status = 'PARKED' WHERE id = p_booking_id;
  UPDATE parking_slots SET status = 'OCCUPIED' WHERE id = v_slot;
END $$;

-- 2d) Checkout + payment: booking → COMPLETED + slot → AVAILABLE + insert payment.
CREATE OR REPLACE FUNCTION public.checkout_booking(
  p_booking_id uuid,
  p_method     payment_method,
  p_amount     numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot uuid;
  v_user uuid;
BEGIN
  SELECT slot_id, user_id INTO v_slot, v_user FROM bookings WHERE id = p_booking_id;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  UPDATE bookings SET status = 'COMPLETED', fee = ROUND(p_amount) WHERE id = p_booking_id;
  UPDATE parking_slots SET status = 'AVAILABLE' WHERE id = v_slot;

  INSERT INTO payments (booking_id, user_id, amount, method, status, paid_at)
  VALUES (p_booking_id, v_user, p_amount, p_method, 'PAID', now())
  ON CONFLICT (booking_id) DO UPDATE
    SET amount = EXCLUDED.amount, method = EXCLUDED.method,
        status = 'PAID', paid_at = now();
END $$;

-- 2e) Cancel/reject: booking → CANCELLED + free slot.
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slot uuid;
BEGIN
  SELECT slot_id INTO v_slot FROM bookings WHERE id = p_booking_id;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;
  UPDATE bookings SET status = 'CANCELLED' WHERE id = p_booking_id;
  UPDATE parking_slots SET status = 'AVAILABLE' WHERE id = v_slot;
END $$;

-- 2f) Move a parked car to another slot (old → AVAILABLE, new → OCCUPIED).
CREATE OR REPLACE FUNCTION public.move_booking(p_booking_id uuid, p_new_slot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_slot uuid;
  v_new_status slot_status;
BEGIN
  SELECT slot_id INTO v_old_slot FROM bookings WHERE id = p_booking_id;
  IF v_old_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  SELECT status INTO v_new_status FROM parking_slots WHERE id = p_new_slot_id FOR UPDATE;
  IF v_new_status IS NULL THEN RAISE EXCEPTION 'SLOT_NOT_FOUND'; END IF;
  IF v_new_status <> 'AVAILABLE' THEN RAISE EXCEPTION 'SLOT_NOT_AVAILABLE'; END IF;

  UPDATE bookings SET slot_id = p_new_slot_id WHERE id = p_booking_id;
  UPDATE parking_slots SET status = 'AVAILABLE' WHERE id = v_old_slot;
  UPDATE parking_slots SET status = 'OCCUPIED'  WHERE id = p_new_slot_id;
END $$;

-- ── 3) Grants so the anon/authenticated client can call the RPCs ───────────────
GRANT EXECUTE ON FUNCTION public.create_walkin_booking(uuid,uuid,timestamp,timestamp,text,text,text,text,text,text,text,text,integer,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_booking(uuid,payment_method,numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_booking(uuid,uuid)          TO anon, authenticated;

-- ── 4) Enable Supabase Realtime on the lifecycle tables ────────────────────────
--     (subscriptions in the frontend never fired because these were not published)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parking_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
