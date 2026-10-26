// Creates the database and loads sample data by running db/schema.sql and
// db/seed.sql. Handles the mysql-client DELIMITER directive, which the
// driver itself does not understand.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

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

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  const dbName = process.env.DB_NAME || 'inventory_db';
  const files = process.argv.includes('--no-seed') ? ['schema.sql'] : ['schema.sql', 'seed.sql'];
  if (process.argv.includes('--with-roles')) files.push('roles.sql'); // needs CREATE ROLE / CREATE USER privileges
  for (const file of files) {
    let sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
    if (dbName !== 'inventory_db') sql = sql.replace(/\binventory_db\b/g, dbName);
    const statements = splitStatements(sql);
    for (const stmt of statements) await conn.query(stmt);
    console.log(`Ran ${file} (${statements.length} statements)`);
  }
  await conn.end();
  console.log(`Database '${dbName}' is ready.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
