// Fills an empty instance with the synthetic sample data, for trying the app out (APP-10.3). Run it on the host:
//   docker exec moped-finance-api npm run load-sample-data
// Start over afterwards with wipe-database.
import path from 'path';
import { DatabaseClient } from '@server/data';
import { SampleData } from '@server/sample-data/sample-data';
import { DateTimeUtil } from '@server/utility';

async function loadSampleData(dbClient: DatabaseClient): Promise<number> {
    // The data sits next to this file: server/seed-data in development, dist/server/seed-data in the production image.
    const sampleData = new SampleData(dbClient, path.join(__dirname, 'seed-data'));
    if (!(await sampleData.isFinanceEmpty())) {
        console.error(
            'This instance already has accounts, categories or transactions, so the sample data would clash with them. ' +
                'Run wipe-database first to start over.'
        );
        return 1;
    }

    console.log('Loading the sample data...');
    const saved = await sampleData.load({ endingBy: DateTimeUtil.today() });
    console.log(
        `Loaded ${saved.accounts} accounts at ${saved.institutions} institutions, ` +
            `${saved.categories} categories in ${saved.categoryGroups} groups, ${saved.budgetStreams} budget items, ` +
            `${saved.transactions} transactions and ${saved.balances} balances, up to ${saved.lastDate}.`
    );
    return 0;
}

async function main(): Promise<void> {
    const dbClient = DatabaseClient.fromEnvironment();
    let exitCode = 1;
    try {
        exitCode = await loadSampleData(dbClient);
    } catch (error) {
        console.error(`Could not load the sample data: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Part of it may have been saved. Run wipe-database to start over.');
    } finally {
        await dbClient.close().catch(() => undefined);
    }
    process.exit(exitCode);
}

main();
