import express, { Request, Response } from 'express';
import session from 'express-session';
import { Server } from 'http';
import path from 'path';
import { buildFinanceRouter } from '@server/api';
import { buildAuthRouter, buildAuthMiddleware, AuthController, UserData } from '@server/auth';
import { DatabaseClient, DatabaseClientConfig } from '@server/data';
import { buildHealthRouter } from '@server/health';
import { AppLogger } from '@server/logging';
import { buildErrorHandler } from '@server/routing';

const app = express();
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

if (process.env.TRUST_FIRST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// Core services
const dbConfig: DatabaseClientConfig = {
    user: process.env.PGUSER || '',
    password: process.env.PGPASSWORD || '',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || '',
    port: parseInt(process.env.PGPORT || '5432'),
};

const dbClient = DatabaseClient.fromConfig(dbConfig);
const logger = AppLogger.fromEnvironment(dbClient);

// Health check (unauthenticated; used by Docker)
let isShuttingDown = false;
app.use('/health', buildHealthRouter({
    pingDatabase: () => dbClient.ping(),
    isShuttingDown: () => isShuttingDown
}));

// Auth module
const userData = new UserData(dbClient);
const authController = new AuthController(userData);
const authMiddleware = buildAuthMiddleware(authController);
const authRoutes = buildAuthRouter(logger, authController, authMiddleware);
app.use('/auth', authRoutes);

// API module
const apiRouter = buildFinanceRouter(logger, dbClient, authMiddleware);
app.use('/api', apiRouter);
app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).send(`${req.originalUrl} not found.`);
});

// Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Errors passed to next(): body parsing, uploads. Must be registered last.
app.use(buildErrorHandler(logger));

const PORT = process.env.PORT || 3000;
let server: Server | undefined;

// Bring the database schema up to date before accepting requests (APP-5.8). The migrations folder sits
// next to this file: server/migrations in development, dist/server/migrations in the production image.
// If migrating fails (including when the database isn't reachable yet), exit and let Docker's restart
// policy try again.
async function start(): Promise<void> {
    try {
        await dbClient.migrate(path.join(__dirname, 'migrations'));
    }
    catch (error: any) {
        // Drizzle wraps the Postgres error (e.g. "relation already exists") as `cause`; its own message is the failed query.
        console.error(`Database migration failed: ${error?.cause?.message ?? error?.message ?? error}`);
        if (error?.cause) {
            console.error(error.message);
        }
        await dbClient.close().catch(() => undefined);
        process.exit(1);
    }

    if (!isShuttingDown) {
        server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    }
}

// Graceful shutdown: on SIGTERM (docker stop) or SIGINT (Ctrl+C), stop accepting connections,
// let in-flight requests finish, then close the database pool. Keep the timeout below the
// container's stop_grace_period (docker-compose.prod.yml), after which Docker sends SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 25_000;

function shutdown(signal: NodeJS.Signals): void {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    console.info(`${signal} received: shutting down.`);

    if (!server) {
        // Still migrating. Each migration runs in a transaction, so Postgres rolls back an unfinished one
        // when the connection drops; the next start applies it again.
        process.exit(0);
    }
    const activeServer = server;

    const forceExit = setTimeout(() => {
        console.error(`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS / 1000}s; exiting.`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    activeServer.close(async (serverError) => {
        try {
            await dbClient.close();
        }
        catch (poolError: any) {
            console.error(`Failed to close the database pool: ${poolError?.message ?? poolError}`);
        }

        if (serverError) {
            console.error(`Failed to close the HTTP server: ${serverError.message}`);
        }
        console.info('Shutdown complete.');
        process.exit(serverError ? 1 : 0);
    });

    // Keep-alive connections with no request in flight would otherwise hold server.close() open.
    activeServer.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
