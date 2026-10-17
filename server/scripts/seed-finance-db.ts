import path from 'path';
import { DatabaseClient } from '@server/data';
import { SampleData } from '@server/sample-data/sample-data';

// Seeds the synthetic sample data in server/seed-data/ (see its README) with its dates as written, which end just
// before the development build's fixed "today". The production image's load-sample-data moves them up to today.
const dbClient = DatabaseClient.fromConfig({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432')
});

(async () => {
    try {
        console.log('🌱 Seeding finance data...');
        const saved = await new SampleData(dbClient, path.join(__dirname, './../seed-data')).load();
        console.log(`✅ ${saved.institutions} institutions, ${saved.accounts} accounts`);
        console.log(`✅ ${saved.categoryGroups} category groups, ${saved.categories} categories`);
        console.log(`✅ ${saved.budgetStreams} budget streams`);
        console.log(`✅ ${saved.transactions} transactions`);
        console.log(`✅ ${saved.balances} balance history entries`);
    } catch (err) {
        console.error(
            '❌ Finance seeding failed. It expects an empty finance schema; run db:reset to start over.',
            err
        );
        process.exitCode = 1;
    } finally {
        await dbClient.close();
    }
})();
