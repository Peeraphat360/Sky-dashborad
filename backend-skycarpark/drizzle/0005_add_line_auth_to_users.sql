-- 0005_add_line_auth_to_users.sql
-- LINE Login support on the users table.
--
-- Customers authenticate with LINE (no email/password), so:
--   1) add line_id + line_display_name (line_id is the unique identity key used
--      for the UPSERT that runs only when a customer confirms a booking), and
--   2) make email/password nullable — they only exist for staff/admin accounts.
--
-- Hand-applied like 0001–0004 (psql / node-pg against DATABASE_URL), not via
-- drizzle-kit migrate. Re-runnable: every statement is guarded.

-- ── 1) LINE identity columns ──────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS line_id           text,
  ADD COLUMN IF NOT EXISTS line_display_name text;

-- Unique LINE id (partial: many NULLs allowed for staff rows that have no LINE).
CREATE UNIQUE INDEX IF NOT EXISTS users_line_id_key
  ON public.users (line_id)
  WHERE line_id IS NOT NULL;

-- ── 2) email / password optional for LINE users ───────────────────────────────
ALTER TABLE public.users ALTER COLUMN email    DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
