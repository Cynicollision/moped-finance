import express, { Request, Response } from 'express';
import path from 'path';
import apiRouter from './api';

const app = express();
const PORT = process.env.PORT || 3000;

// --- API Routes ---
// All routes defined in the api.ts file will be prefixed with /api
app.use('/api', apiRouter);


app.use(express.static(path.join(__dirname, './..', 'public')));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Server Startup ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));