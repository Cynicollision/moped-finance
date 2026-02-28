import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const dbConfig = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

async function init() {
  const client = await pool.connect();
  try {
    console.log('🏗️  Applying database schema...');
    const sqlPath = path.join(__dirname, './schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Schema applied successfully.');
  }
  catch (err) {
    console.error('❌ Schema application failed:', err);
    process.exit(1);
  }
  finally {
    client.release();
    await pool.end();
  }
}

init();