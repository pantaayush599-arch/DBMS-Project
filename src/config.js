// Database connection settings, read from the environment.
// Supports a single URL (MYSQL_URL / DATABASE_URL, as given by Railway, Render, Aiven...)
// or the individual DB_* variables used for local development.
const fs = require('fs');
require('dotenv').config();

function connectionOptions() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  let opts;
  if (url) {
    const u = new URL(url);
    opts = {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    };
  } else {
    opts = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    };
  }
  // Hosted MySQL services outside a private network usually require TLS.
  if (process.env.DB_SSL === 'true') {
    opts.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
    if (process.env.DB_SSL_CA) opts.ssl.ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
  }
  return opts;
}

// The app always uses its own database (created by db/schema.sql), not the URL's default one.
const dbName = process.env.DB_NAME || 'inventory_db';

module.exports = { connectionOptions, dbName };
