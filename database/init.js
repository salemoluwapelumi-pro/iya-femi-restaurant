// Creates all tables from database/schema/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, 'schema', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database schema created.');
  await pool.end();
}

main().catch((err) => {
  console.error('Schema initialization failed:', err.message);
  process.exit(1);
});
