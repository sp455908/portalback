require('dotenv').config();

const { Client } = require('pg');

const urlFromEnv = process.env.DATABASE_URL || '';
const connectionString = urlFromEnv.trim();

if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

(async () => {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Postgres with pg...');
    await client.connect();
    console.log('Connected. Running test query...');
    const res = await client.query('SELECT current_user, current_database(), version()');
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.error('pg connection error:', err);
  } finally {
    try { await client.end(); } catch (_) {}
  }
})();

