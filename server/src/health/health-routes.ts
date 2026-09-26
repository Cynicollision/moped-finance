import { Router } from 'express';

export interface HealthCheckDependencies {
    /** Throws if the database can't be reached. */
    pingDatabase(): Promise<void>;
    /** True once shutdown has started, so load balancers and health checks stop sending traffic. */
    isShuttingDown(): boolean;
}

/**
 * `GET /health`: 200 when the API can reach the database, 503 otherwise or while shutting down.
 * Unauthenticated and not logged per request, since Docker polls it. The body never includes error details.
 */
export function buildHealthRouter(deps: HealthCheckDependencies): Router {
    const router = Router();

    router.get('/', async (_req, res) => {
        if (deps.isShuttingDown()) {
            res.status(503).json({ status: 'shutting-down' });
            return;
        }

        try {
            await deps.pingDatabase();
            res.status(200).json({ status: 'ok' });
        }
        catch {
            res.status(503).json({ status: 'database-unavailable' });
        }
    });

    return router;
}
