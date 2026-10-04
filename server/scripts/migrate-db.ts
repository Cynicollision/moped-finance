import path from 'path';
import { DatabaseClient } from '@server/data';

// The server also applies migrations on startup; this is for db:reset and for running them by hand.
const dbClient = DatabaseClient.fromConfig({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432')
});

(async () => {
    try {
        console.log('🏗️  Applying migrations...');
        await dbClient.migrate(path.join(__dirname, './../migrations'));
        console.log('✅ Migrations applied.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exitCode = 1;
    } finally {
        await dbClient.close();
    }
})();
