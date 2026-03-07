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

(async () => {
    const client = await pool.connect();
    try {
        console.log('🏗️  Applying core schema...');
        const sqlPath = path.join(__dirname, './schema_core.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Core schema applied.');
    }
    catch (err) {
        console.error('❌ Core schema application failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();