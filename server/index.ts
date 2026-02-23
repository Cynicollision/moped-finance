import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import apiRouter from './src/app-router';

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'development') {
  app.use(cors({
    origin: 'http://localhost:4200'
  }));
}

app.use('/api', apiRouter);

app.use(express.static(path.join(__dirname, './..', 'public')));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));