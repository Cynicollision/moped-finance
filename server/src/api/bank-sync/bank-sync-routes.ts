import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler } from '@server/routing';
import { BankSyncController } from './bank-sync-controller';
import { connectSchema } from './simplefin-schema';

const domain = 'BankSync';

/** Bank sync (SYNC), mounted at /api/v1/bank-sync. Nothing here ever returns the access URL. */
export function createBankSyncRouter(logger: IAppLogger, controller: BankSyncController): Router {
    const router = Router();
    const handler = new OperationHandler(logger);

    // GET / - Status: connected, paused, the last run and the limit
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getStatus' };
        handler.execute(req, res, op, () => controller.getStatus());
    });

    // POST /connect - Claim a setup token and sync (also Connect again)
    router.post('/connect', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'connect' };
        handler.execute(req, res, op, { body: connectSchema }, (_context, { body }) => controller.connect(body));
    });

    // DELETE / - Disconnect
    router.delete('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'disconnect' };
        handler.execute(req, res, op, () => controller.disconnect());
    });

    // GET /accounts - The bank accounts from the latest sync
    router.get('/accounts', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'retrieveAccounts' };
        handler.execute(req, res, op, () => controller.retrieveAccounts());
    });

    // POST /sync - Sync now
    router.post('/sync', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'sync' };
        handler.execute(req, res, op, () => controller.sync());
    });

    // GET /runs - The latest runs, newest first
    router.get('/runs', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'retrieveRuns' };
        handler.execute(req, res, op, () => controller.retrieveRuns());
    });

    return router;
}
