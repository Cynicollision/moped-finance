import { Pool } from 'pg';

const dbConfig = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE,
  port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

async function reset() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Dropping schemas...');

    // Drop specific app schemas
    await client.query('DROP SCHEMA IF EXISTS finance CASCADE;');

    // Re-create public schema to wipe all standard tables
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    // Restore default permissions (Postgres 15+ security change)
    //await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('✅ Database wiped clean.');
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();