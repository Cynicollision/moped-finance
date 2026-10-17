// Deletes everything and leaves an empty instance, as on first start (APP-10.1). Run it on the host:
//   docker exec -it moped-finance-api npm run wipe-database
// With input piped in instead of a terminal, it reads the confirmation from the first line.
import path from 'path';
import readline from 'readline';
import { sql } from 'drizzle-orm';
import { PasswordReset, UserData } from '@server/auth';
import { DatabaseClient } from '@server/data';

const confirmation = 'wipe';

/** The first line typed or piped in, or undefined when the input ends first. */
async function readLine(prompt: string): Promise<string | undefined> {
    process.stdout.write(prompt);
    const lines = readline.createInterface({ input: process.stdin });
    try {
        for await (const line of lines) {
            return line;
        }
        return undefined;
    } finally {
        lines.close();
    }
}

async function wipeDatabase(dbClient: DatabaseClient): Promise<number> {
    // The owner is only for the warning; a database that was never migrated has no users table.
    const owner = await new PasswordReset(new UserData(dbClient)).owner().catch(() => null);
    console.log(`This deletes everything in the database '${process.env.PGDATABASE ?? ''}', and can't be undone:`);
    if (owner) {
        console.log(`  - the user ${owner.username} (${owner.displayName}), their API tokens and settings`);
    }
    console.log('  - every institution, account, balance, category, budget item and transaction');
    const answer = await readLine(`Type '${confirmation}' to continue: `);
    if (answer?.trim() !== confirmation) {
        console.log('Cancelled. Nothing was deleted.');
        return 1;
    }

    // `drizzle` holds the record of applied migrations, so dropping it lets them run again from the start.
    await dbClient.drizzle.execute(sql`DROP SCHEMA IF EXISTS core, finance, drizzle CASCADE`);
    // Recreate the empty tables now, as the server does on startup (APP-5.8), so the running app keeps working.
    // The migrations sit next to this file: server/migrations in development, dist/server/migrations in the image.
    await dbClient.migrate(path.join(__dirname, 'migrations'));

    console.log('Done: the database is empty and registration is open again.');
    console.log('Restart the app so it forgets the old session secret and sign-in lockouts:');
    console.log('  docker restart moped-finance-api');
    return 0;
}

async function main(): Promise<void> {
    const dbClient = DatabaseClient.fromEnvironment();
    let exitCode = 1;
    try {
        exitCode = await wipeDatabase(dbClient);
    } catch (error) {
        console.error(`Could not wipe the database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        await dbClient.close().catch(() => undefined);
    }
    process.exit(exitCode);
}

main();
