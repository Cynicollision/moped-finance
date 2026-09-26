import express, { Request, Response } from 'express';
import session from 'express-session';
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
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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

    const forceExit = setTimeout(() => {
        console.error(`Shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS / 1000}s; exiting.`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async (serverError) => {
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
    server.closeIdleConnections();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
