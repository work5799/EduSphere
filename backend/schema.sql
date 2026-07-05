-- EduSphere Database Schema Migration
-- Run this ONCE in your Supabase Dashboard → SQL Editor

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'moderator', 'student')),
  status VARCHAR(50) NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses table
CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail TEXT,
  category VARCHAR(255),
  price NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR(255) PRIMARY KEY,
  course_id VARCHAR(255) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 4. Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id VARCHAR(255) PRIMARY KEY,
  chapter_id VARCHAR(255) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK(type IN ('video', 'audio', 'pdf')),
  drive_link TEXT,
  sort_order INTEGER DEFAULT 0
);

-- 5. Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(255) PRIMARY KEY,
  student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id VARCHAR(255) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, course_id)
);

-- 6. Lesson completions table
CREATE TABLE IF NOT EXISTS lesson_completions (
  id VARCHAR(255) PRIMARY KEY,
  student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id VARCHAR(255) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, lesson_id)
);

-- 7. Disable Row Level Security so our backend can access all data freely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
ALTER TABLE lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions DISABLE ROW LEVEL SECURITY;

-- Done! All EduSphere tables created successfully.
