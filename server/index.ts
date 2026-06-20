import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { buildFinanceRouter } from '@server/api';
import { buildAuthRouter, buildAuthMiddleware, AuthController, UserData } from '@server/auth';
import { DatabaseClient, DatabaseClientConfig } from '@server/data';
import { AppLogger } from '@server/logging';

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
