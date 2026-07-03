const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

// Initialize connection
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase') || process.env.DB_SSL === 'true' 
      ? { rejectUnauthorized: false } 
      : false
  });
  dbType = 'postgres';
  console.log('Database Client: PostgreSQL (Connected to Supabase/Remote)');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'edusphere.db');
  sqliteDb = new sqlite3.Database(dbPath);
  dbType = 'sqlite';
  console.log(`Database Client: SQLite (Local file: ${dbPath})`);
}

// Helper to execute query
async function query(sql, params = []) {
  if (dbType === 'postgres') {
    try {
      const res = await pgPool.query(sql, params);
      return res;
    } catch (err) {
      console.error('Postgres Query Error:', err);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      // In SQLite, placeholders are ? but we might use $1, $2 if we write PG style.
      // Let's translate PostgreSQL parameter syntax ($1, $2, ...) to SQLite (?1, ?2, ...)
      // Or we can write a regex helper to convert $1 to ? or SQLite parameters.
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) {
            console.error('SQLite Query Error (SELECT):', err);
            reject(err);
          } else {
            resolve({ rows });
          }
        });
      } else {
        sqliteDb.run(sqliteSql, params, function (err) {
          if (err) {
            console.error('SQLite Query Error (EXEC):', err);
            reject(err);
          } else {
            resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
          }
        });
      }
    });
  }
}

// Database Initialization Script
async function initDb() {
  const sqliteSchema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail TEXT,
      category TEXT,
      price REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('video', 'audio', 'pdf')),
      drive_link TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(student_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS lesson_completions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      UNIQUE(student_id, lesson_id)
    );
  `;

  const postgresSchema = `
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
  `;

  if (dbType === 'postgres') {
    try {
      await pgPool.query(postgresSchema);
      console.log('PostgreSQL database tables initialized successfully.');
    } catch (err) {
      console.error('Error initializing PostgreSQL database tables:', err);
    }
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.exec(sqliteSchema, (err) => {
        if (err) {
          console.error('Error initializing SQLite database tables:', err);
          reject(err);
        } else {
          console.log('SQLite database tables initialized successfully.');
          resolve();
        }
      });
    });
  }
}

// Generate new ID (UUID v4 format or similar safe text string)
function generateId() {
  return crypto.randomUUID();
}

module.exports = {
  query,
  initDb,
  generateId,
  getDbType: () => dbType
};
