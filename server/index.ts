import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { createAuthRouter, createAuthMiddleware } from '@server-core/auth';
import { CoreUserData } from '@server-core/data/user-data';
import { AppLogger } from '@server-core/logger';
import { DatabaseClient, DatabaseClientConfig } from '@server-core/db-client';
import { createFinanceModule } from './src/finance';

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

if (process.env.NODE_ENV === 'development') {
    app.use(cors({
        origin: 'http://localhost:4200',
        credentials: true
    }));
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

// Auth module
const userData = new CoreUserData(dbClient);
const { resolveUser, requireAuth } = createAuthMiddleware(userData);
const authRoutes = createAuthRouter(userData, logger, requireAuth, resolveUser);
app.use('/auth', authRoutes);

// API module routes
const apiRouter = createFinanceModule(dbClient, logger);
app.use('/api', resolveUser, requireAuth, apiRouter);
app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).send(`${req.originalUrl} not found.`);
});

// Frontend routes
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
