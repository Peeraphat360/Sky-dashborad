-- 0004_add_coupon_code.sql
-- Persist the discount coupon code entered at checkout so it shows up in reports.
-- The DB previously stored only the final (discounted) amount via checkout_booking;
-- this migration adds the raw coupon string and threads it through the RPC.

-- ── 1) Add the nullable column ────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS coupon_code varchar(50);

-- ── 2) Replace checkout_booking to accept + persist the coupon code ────────────
--     Drop the old 3-arg signature first so only ONE overload exists (avoids
--     PostgREST ambiguity when the frontend calls it). p_coupon_code has a
--     DEFAULT so any caller that omits it (e.g. legacy / no coupon) still works.
DROP FUNCTION IF EXISTS public.checkout_booking(uuid, payment_method, numeric);

CREATE OR REPLACE FUNCTION public.checkout_booking(
  p_booking_id  uuid,
  p_method      payment_method,
  p_amount      numeric,
  p_coupon_code text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot uuid;
  v_user uuid;
BEGIN
  SELECT slot_id, user_id INTO v_slot, v_user FROM bookings WHERE id = p_booking_id;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND'; END IF;

  UPDATE bookings
    SET status      = 'COMPLETED',
        fee         = ROUND(p_amount),
        -- store NULL when no/blank coupon was provided
        coupon_code = NULLIF(TRIM(p_coupon_code), '')
    WHERE id = p_booking_id;

  UPDATE parking_slots SET status = 'AVAILABLE' WHERE id = v_slot;

  INSERT INTO payments (booking_id, user_id, amount, method, status, paid_at)
  VALUES (p_booking_id, v_user, p_amount, p_method, 'PAID', now())
  ON CONFLICT (booking_id) DO UPDATE
    SET amount = EXCLUDED.amount, method = EXCLUDED.method,
        status = 'PAID', paid_at = now();
END $$;

-- ── 3) Re-grant execute on the new signature ──────────────────────────────────
GRANT EXECUTE ON FUNCTION public.checkout_booking(uuid, payment_method, numeric, text)
  TO anon, authenticated;
