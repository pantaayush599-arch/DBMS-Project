const mysql = require('mysql2/promise');
const { connectionOptions, dbName } = require('./config');

const pool = mysql.createPool({
  ...connectionOptions(),
  database: dbName,
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
