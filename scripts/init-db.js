// Drops and recreates the database with sample data.
//   npm run db:init                 schema + sample data
//   npm run db:init -- --no-seed    empty schema
//   npm run db:init:roles           also create MySQL roles/users (needs GRANT OPTION)
const { initDatabase } = require('../src/init');
const { dbName } = require('../src/config');

const files = process.argv.includes('--no-seed') ? ['schema.sql'] : ['schema.sql', 'seed.sql'];
if (process.argv.includes('--with-roles')) files.push('roles.sql');

initDatabase(files)
  .then(() => console.log(`Database '${dbName}' is ready.`))
  .catch((err) => { console.error(err.message); process.exit(1); });
