const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_db',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// CALL returns [resultSets..., okPacket]; we only use procedures for side effects.
async function call(procedure, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  await pool.query(`CALL ${procedure}(${placeholders})`, params);
}

module.exports = { pool, query, call };
