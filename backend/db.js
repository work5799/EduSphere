const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

let dbType = 'sqlite';
let supabase = null;
let sqliteDb = null;

// Use Supabase JS SDK if SUPABASE_URL and SUPABASE_SECRET_KEY are available
// This uses HTTPS REST API — no TCP connection, no URL parsing issues
if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL.trim(),
    process.env.SUPABASE_SECRET_KEY.trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  dbType = 'supabase';
  console.log('Database Client: Supabase JS SDK (HTTPS REST API)');
} else {
  // Fallback to SQLite for local development without Supabase credentials
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'edusphere.db');
  sqliteDb = new sqlite3.Database(dbPath);
  dbType = 'sqlite';
  console.log(`Database Client: SQLite (Local file: ${dbPath})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase query compatibility layer
// Maps SQL-style calls to Supabase JS SDK calls
// ─────────────────────────────────────────────────────────────────────────────

async function query(sql, params = []) {
  if (dbType === 'supabase') {
    return await supabaseQuery(sql, params);
  } else {
    return await sqliteQuery(sql, params);
  }
}

async function supabaseQuery(sql, params = []) {
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  const upper = trimmed.toUpperCase();

  // ── SELECT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('SELECT')) {
    return await supabaseSelect(trimmed, params);
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  if (upper.startsWith('INSERT')) {
    return await supabaseInsert(trimmed, params);
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('UPDATE')) {
    return await supabaseUpdate(trimmed, params);
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (upper.startsWith('DELETE')) {
    return await supabaseDelete(trimmed, params);
  }

  // ── CREATE TABLE (schema init) ────────────────────────────────────────────
  if (upper.startsWith('CREATE TABLE')) {
    // Tables are created via Supabase SQL editor — skip silently
    console.log('[db] CREATE TABLE skipped (managed by Supabase)');
    return { rows: [], rowCount: 0 };
  }

  throw new Error(`Unsupported SQL statement: ${sql.substring(0, 60)}`);
}

// ─── SELECT helper ────────────────────────────────────────────────────────────
async function supabaseSelect(sql, params) {
  // Extract table(s) — handle JOINs by using RPC for complex queries
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) throw new Error('Could not parse table from SELECT: ' + sql);

  const table = tableMatch[1].toLowerCase();
  const hasJoin = /\bJOIN\b/i.test(sql);
  const hasCount = /COUNT\(/i.test(sql);

  // Complex JOIN / COUNT queries → use Supabase RPC exec_sql
  if (hasJoin || hasCount) {
    return await rpcExecSql(sql, params);
  }

  // Simple SELECT * FROM table WHERE col = $1
  let qb = supabase.from(table).select('*');
  qb = applyWhereParams(qb, sql, params);

  // ORDER BY
  const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    qb = qb.order(orderMatch[1], { ascending: (orderMatch[2] || 'ASC').toUpperCase() !== 'DESC' });
  }

  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  return { rows: data || [] };
}

// ─── INSERT helper ────────────────────────────────────────────────────────────
async function supabaseInsert(sql, params) {
  const tableMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (!tableMatch) throw new Error('Could not parse INSERT: ' + sql);

  const table = tableMatch[1].toLowerCase();
  const columns = tableMatch[2].split(',').map(c => c.trim());

  // On Conflict → upsert with ignoreDuplicates
  const hasOnConflict = /ON CONFLICT/i.test(sql);

  const record = {};
  columns.forEach((col, i) => {
    record[col] = params[i] !== undefined ? params[i] : null;
  });

  let qb = supabase.from(table).insert(record);
  if (hasOnConflict) {
    qb = supabase.from(table).upsert(record, { ignoreDuplicates: true });
  }

  const { error } = await qb;
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  return { rows: [], rowCount: 1 };
}

// ─── UPDATE helper ────────────────────────────────────────────────────────────
async function supabaseUpdate(sql, params) {
  const tableMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/is);
  if (!tableMatch) throw new Error('Could not parse UPDATE: ' + sql);

  const table = tableMatch[1].toLowerCase();
  const setPart = tableMatch[2];
  const wherePart = tableMatch[3];

  // Parse SET columns: col = $1, col2 = $2 ...
  const setCols = setPart.split(',').map(s => s.trim().split(/\s*=\s*\$\d+/)[0].trim());
  // Parse WHERE: id = $N (last param)
  const whereColMatch = wherePart.match(/(\w+)\s*=\s*\$(\d+)/);

  if (!whereColMatch) throw new Error('Could not parse WHERE in UPDATE: ' + sql);

  const whereCol = whereColMatch[1];
  const whereParamIdx = parseInt(whereColMatch[2]) - 1;

  const updates = {};
  setCols.forEach((col, i) => {
    updates[col] = params[i] !== undefined ? params[i] : null;
  });

  const { error, count } = await supabase
    .from(table)
    .update(updates)
    .eq(whereCol, params[whereParamIdx]);

  if (error) throw new Error(error.message);
  return { rows: [], rowCount: count || 1 };
}

// ─── DELETE helper ────────────────────────────────────────────────────────────
async function supabaseDelete(sql, params) {
  const tableMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
  if (!tableMatch) throw new Error('Could not parse DELETE: ' + sql);

  const table = tableMatch[1].toLowerCase();
  let qb = supabase.from(table);
  qb = applyWhereParams(qb.delete(), sql, params);

  const { error, count } = await qb;
  if (error) throw new Error(error.message);
  return { rows: [], rowCount: count || 1 };
}

// ─── WHERE clause helper ──────────────────────────────────────────────────────
function applyWhereParams(qb, sql, params) {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/is);
  if (!whereMatch || params.length === 0) return qb;

  const conditions = whereMatch[1].trim();
  // Match: col = $N AND col2 = $N2 ...
  const condParts = conditions.split(/\s+AND\s+/i);
  condParts.forEach(part => {
    const m = part.match(/(\w+)\s*=\s*\$(\d+)/);
    if (m) {
      const col = m[1];
      const idx = parseInt(m[2]) - 1;
      if (params[idx] !== undefined) {
        qb = qb.eq(col, params[idx]);
      }
    }
  });
  return qb;
}

// ─── RPC exec_sql for complex JOIN/COUNT queries ──────────────────────────────
async function rpcExecSql(sql, params) {
  // Replace $1, $2, ... with actual values (safe — server-side only)
  let resolvedSql = sql;
  params.forEach((val, i) => {
    const escaped = typeof val === 'string' ? val.replace(/'/g, "''") : val;
    resolvedSql = resolvedSql.replace(new RegExp('\\$' + (i + 1), 'g'), `'${escaped}'`);
  });

  const { data, error } = await supabase.rpc('exec_sql', { query: resolvedSql });
  if (error) {
    // Fallback: try direct table approach for COUNT queries
    return await fallbackCount(sql, params);
  }
  return { rows: data || [] };
}

// ─── Fallback COUNT helper ────────────────────────────────────────────────────
async function fallbackCount(sql, params) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  if (!tableMatch) return { rows: [{ count: 0 }] };

  const table = tableMatch[1].toLowerCase();
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) throw new Error(error.message);
  return { rows: [{ count: count || 0 }] };
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite fallback (local dev)
// ─────────────────────────────────────────────────────────────────────────────
async function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
      sqliteDb.all(sqliteSql, params, (err, rows) => {
        if (err) { console.error('SQLite Query Error:', err); reject(err); }
        else resolve({ rows });
      });
    } else {
      sqliteDb.run(sqliteSql, params, function (err) {
        if (err) { console.error('SQLite Query Error:', err); reject(err); }
        else resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Schema Initialization
// ─────────────────────────────────────────────────────────────────────────────
async function initDb() {
  if (dbType === 'supabase') {
    // Tables must be created via Supabase SQL Editor
    // Test connection by pinging the users table
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code === '42P01') {
      throw new Error(
        'Tables not found in Supabase! Please run the SQL migration in your Supabase SQL Editor. ' +
        'Go to: Supabase Dashboard → SQL Editor → paste the schema SQL and run it.'
      );
    }
    console.log('Supabase connection verified — tables exist.');
    return;
  }

  // SQLite initialization
  const sqliteSchema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'moderator', 'student')),
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

  return new Promise((resolve, reject) => {
    sqliteDb.exec(sqliteSchema, (err) => {
      if (err) {
        console.error('SQLite init error:', err);
        reject(err);
      } else {
        console.log('SQLite tables initialized.');
        // Run migration check to add moderator role if not already present
        sqliteDb.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
          if (err) {
            console.error('Error checking users schema:', err);
            return reject(err);
          }
          if (row && row.sql && !row.sql.includes('moderator')) {
            console.log('Migrating users table check constraint to support moderator...');
            sqliteDb.serialize(() => {
              sqliteDb.run("PRAGMA foreign_keys=OFF;", (err) => { if (err) console.error(err); });
              sqliteDb.run("BEGIN TRANSACTION;", (err) => { if (err) console.error(err); });
              
              sqliteDb.run(`
                CREATE TABLE users_new (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  email TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL,
                  role TEXT NOT NULL CHECK(role IN ('admin', 'moderator', 'student')),
                  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
                  phone TEXT,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
              `, (err) => { if (err) console.error(err); });
              
              sqliteDb.run(`
                INSERT INTO users_new (id, name, email, password_hash, role, status, phone, created_at)
                SELECT id, name, email, password_hash, role, status, phone, created_at FROM users;
              `, (err) => { if (err) console.error(err); });
              
              sqliteDb.run("DROP TABLE users;", (err) => { if (err) console.error(err); });
              sqliteDb.run("ALTER TABLE users_new RENAME TO users;", (err) => { if (err) console.error(err); });
              
              sqliteDb.run("COMMIT;", (err) => {
                if (err) {
                  sqliteDb.run("ROLLBACK;");
                  console.error('Migration failed, rolled back.', err);
                  reject(err);
                } else {
                  sqliteDb.run("PRAGMA foreign_keys=ON;", (err) => {
                    if (err) console.error(err);
                    console.log('Successfully migrated users table to support moderator.');
                    resolve();
                  });
                }
              });
            });
          } else {
            resolve();
          }
        });
      }
    });
  });
}

function generateId() {
  return crypto.randomUUID();
}

module.exports = {
  query,
  initDb,
  generateId,
  getDbType: () => dbType,
  getSupabase: () => supabase
};
