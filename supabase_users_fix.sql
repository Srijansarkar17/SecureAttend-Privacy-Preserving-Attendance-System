-- Run this in Supabase SQL Editor to fix the FK constraint

-- Drop the foreign key that ties users.id to auth.users.id
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Also add password column if not already there
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- Make sure RLS is permissive
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);
