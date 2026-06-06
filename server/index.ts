import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { createAuthRouter } from '@core/auth/auth-routes';
import { createAuthMiddleware } from '@core/auth/auth-middleware';
import { CoreUserData } from '@core/data/user-data';
import { GeminiGateway } from '@core/gateways/gemini-gateway';
import { AppLogger } from '@core/logger';
import { DatabaseClient } from '@core/db';
import { ApiUtil } from '@core/utility';
import { createApiRouter } from '@features/api-routes';

const app = express();

// Trust the first proxy (essential for secure cookies in Docker/Nginx)
app.set('trust proxy', 1); // TODO: needs review.
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

if (process.env.NODE_ENV === 'development') {
    app.use(cors({
        origin: 'http://localhost:4200',
        credentials: true
    }));
}

// Core modules
const dbClient = new DatabaseClient();
const logger = AppLogger.fromEnvironment(dbClient);
const userData = new CoreUserData(dbClient);
const llmGateway = GeminiGateway.fromEnvironment();

// Auth routes
const { resolveUser, requireAuth } = createAuthMiddleware(userData);
const authRoutes = createAuthRouter(userData, logger, requireAuth, resolveUser);
app.use('/auth', authRoutes);

// API routes
const apiRouter = createApiRouter(dbClient, logger, llmGateway, resolveUser, requireAuth);
app.use('/api', apiRouter);

// Default 404 handler for unmatched API routes
app.all('/api/*', (req: Request, res: Response) => {
    return ApiUtil.notFound(req, res);
});

// Frontend routes
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
