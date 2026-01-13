-- ===========================================
-- Supabase SQL Script: Students Table
-- สำหรับระบบสุ่มรางวัลวันเด็ก
-- ===========================================

-- Create students table
CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  room TEXT NOT NULL,
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  is_winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries on is_winner
CREATE INDEX idx_students_is_winner ON students(is_winner);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for demo purposes)
-- In production, you should restrict this based on authentication
CREATE POLICY "Allow all operations" ON students
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ===========================================
-- วิธีใช้งาน:
-- 1. ไปที่ Supabase Dashboard > SQL Editor
-- 2. Copy โค้ดนี้ทั้งหมด
-- 3. กด Run เพื่อสร้าง Table
-- ===========================================
