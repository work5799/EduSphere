/**
 * EduSphere — Supabase Migration Script
 * Run this once to create all tables and seed the admin account.
 * Usage: node migrate.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ── Supabase Transaction Pooler connection params ─────────────────────────────
// Using individual params (not connection string) to avoid URL parsing issues
const pool = new Pool({
  host:     'aws-0-ap-southeast-1.pooler.supabase.com',
  user:     'postgres.skbxjeqzgasgnevuecup',
  password: 'BC#Sa#Q2WG+eq%T',
  port:     6543,
  database: 'postgres',
  ssl:      { rejectUnauthorized: false }
});

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'student')),
    status VARCHAR(50) NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail TEXT,
    category VARCHAR(255),
    price NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(255) PRIMARY KEY,
    course_id VARCHAR(255) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(255) PRIMARY KEY,
    chapter_id VARCHAR(255) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK(type IN ('video', 'audio', 'pdf')),
    drive_link TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id VARCHAR(255) PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id VARCHAR(255) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS lesson_completions (
    id VARCHAR(255) PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id VARCHAR(255) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, lesson_id)
  );

  ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
  ALTER TABLE chapters DISABLE ROW LEVEL SECURITY;
  ALTER TABLE lessons DISABLE ROW LEVEL SECURITY;
  ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE lesson_completions DISABLE ROW LEVEL SECURITY;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('✅ Connected to Supabase!');
    console.log('📦 Creating tables...');
    await client.query(schema);
    console.log('✅ All tables created!');

    // Seed admin account
    const adminEmail = 'rayhan5799@gmail.com';
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

    if (existing.rows.length === 0) {
      const adminId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash('Rayhan5799@#', 10);
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'System Admin', adminEmail, passwordHash, 'admin', 'approved', '01700000000']
      );
      console.log('✅ Admin account created!');
      console.log('   Email:    rayhan5799@gmail.com');
      console.log('   Password: Rayhan5799@#');
    } else {
      console.log('ℹ️  Admin account already exists — skipped.');
    }

    console.log('\n🎉 Migration complete! Your EduSphere Supabase database is ready.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
