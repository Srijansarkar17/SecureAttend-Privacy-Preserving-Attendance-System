-- ============================================================
-- SecureAttend — Supabase Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste & Run
-- ============================================================

-- ── Drop existing policies (safe to run multiple times) ─────
DO $$ 
BEGIN
    -- profiles
    DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    -- subjects
    DROP POLICY IF EXISTS "Anyone can read subjects" ON subjects;
    DROP POLICY IF EXISTS "Anyone can insert subjects" ON subjects;
    DROP POLICY IF EXISTS "Anyone authenticated can read subjects" ON subjects;
    -- enrollments
    DROP POLICY IF EXISTS "Anyone can read enrollments" ON enrollments;
    DROP POLICY IF EXISTS "Anyone can insert enrollments" ON enrollments;
    -- face_registry
    DROP POLICY IF EXISTS "Anyone can read face_registry" ON face_registry;
    DROP POLICY IF EXISTS "Anyone can insert face_registry" ON face_registry;
    DROP POLICY IF EXISTS "Anyone can update face_registry" ON face_registry;
    -- attendance
    DROP POLICY IF EXISTS "Anyone can read attendance" ON attendance;
    DROP POLICY IF EXISTS "Anyone can insert attendance" ON attendance;
    DROP POLICY IF EXISTS "Teachers can view all attendance" ON attendance;
    DROP POLICY IF EXISTS "Students can view own attendance" ON attendance;
    DROP POLICY IF EXISTS "Service role can insert attendance" ON attendance;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 1. Profiles table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    student_id TEXT,
    department TEXT DEFAULT 'Computer Science',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Subjects table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    schedule_time TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Enrollments table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, subject_id)
);

-- ── 4. Face Registry — add missing columns if needed ────────
-- Drop and recreate to ensure correct schema
DROP TABLE IF EXISTS face_registry CASCADE;
CREATE TABLE face_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    public_hash TEXT NOT NULL,
    embedding FLOAT8[] NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Attendance table — recreate for clean schema ─────────
DROP TABLE IF EXISTS attendance CASCADE;
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID,
    student_name TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    subject_code TEXT,
    check_in_time TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Absent')),
    zk_verified BOOLEAN DEFAULT false,
    proof_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(created_at);
CREATE INDEX IF NOT EXISTS idx_face_registry_user ON face_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_face_registry_name ON face_registry(name);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ── 7. Seed subjects ───────────────────────────────────────
INSERT INTO subjects (code, name, schedule_time) VALUES
    ('CS 301', 'Data Structures', '10:00 AM'),
    ('CS 305', 'Algorithms', '12:00 PM'),
    ('CS 401', 'Machine Learning', '02:00 PM'),
    ('CS 450', 'AI Ethics', '04:00 PM')
ON CONFLICT (code) DO NOTHING;

-- ── 8. Enable RLS ──────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- ── 9. RLS Policies (permissive for demo) ──────────────────

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (true);

-- Subjects
CREATE POLICY "subjects_select" ON subjects FOR SELECT USING (true);
CREATE POLICY "subjects_insert" ON subjects FOR INSERT WITH CHECK (true);

-- Enrollments
CREATE POLICY "enrollments_select" ON enrollments FOR SELECT USING (true);
CREATE POLICY "enrollments_insert" ON enrollments FOR INSERT WITH CHECK (true);

-- Face Registry
CREATE POLICY "face_registry_select" ON face_registry FOR SELECT USING (true);
CREATE POLICY "face_registry_insert" ON face_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "face_registry_update" ON face_registry FOR UPDATE USING (true);

-- Attendance
CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (true);
CREATE POLICY "attendance_insert" ON attendance FOR INSERT WITH CHECK (true);

-- ── 10. Auto-create profile on signup ──────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, student_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        NEW.raw_user_meta_data->>'student_id'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
