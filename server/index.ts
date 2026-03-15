import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import apiRoutes from './src/api-routes';
import authRoutes from './src/routes/auth-routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy (essential for secure cookies in Docker/Nginx)
app.set('trust proxy', 1); // TODO: needs review.

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

if (process.env.NODE_ENV === 'development') {
    app.use(cors({
        origin: 'http://localhost:4200',
        credentials: true
    }));
}

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, './..', 'public')));

app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));