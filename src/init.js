// Creates the database by running db/schema.sql (+ seed.sql, roles.sql).
// Handles the mysql-client DELIMITER directive, which the driver itself does not understand.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { connectionOptions, dbName } = require('./config');

// Remove a trailing "-- comment" from a line, ignoring "--" inside quotes.
function stripLineComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '-' && line[i + 1] === '-' && /\s|$/.test(line[i + 2] || '')) return line.slice(0, i);
  }
  return line;
}

function splitStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';
  for (const raw of sql.split(/\r?\n/)) {
    const line = stripLineComment(raw);
    const d = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (d) { delimiter = d[1]; continue; }
    if (!line.trim()) continue;
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) {
      const stmt = buffer.trimEnd().slice(0, -delimiter.length).trim();
      if (stmt) statements.push(stmt);
      buffer = '';
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

// Drops and recreates the database. files: names inside db/.
async function initDatabase(files = ['schema.sql', 'seed.sql'], log = console.log) {
  const conn = await mysql.createConnection(connectionOptions());
  try {
    for (const file of files) {
      let sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
      if (dbName !== 'inventory_db') sql = sql.replace(/\binventory_db\b/g, dbName);
      const statements = splitStatements(sql);
      for (const stmt of statements) await conn.query(stmt);
      log(`Ran ${file} (${statements.length} statements)`);
    }
  } finally {
    await conn.end();
  }
}

// On first start (database missing or empty) create it with sample data.
// An existing database with tables is never touched.
async function ensureDatabase(log = console.log) {
  const conn = await mysql.createConnection(connectionOptions());
  let tables;
  let hasUsers;
  try {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n, SUM(TABLE_NAME = 'app_user') AS users
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`, [dbName]);
    tables = Number(rows[0].n);
    hasUsers = Number(rows[0].users) > 0;
  } finally {
    await conn.end();
  }
  if (tables === 0) {
    log(`Database '${dbName}' is empty, creating schema and sample data...`);
    await initDatabase(['schema.sql', 'seed.sql'], log);
  } else if (!hasUsers) {
    log(`Warning: '${dbName}' has no app_user table (created by an older version). Run "npm run db:init" to rebuild it.`);
  }
}

module.exports = { initDatabase, ensureDatabase, splitStatements };
