import { Router, Request, Response } from 'express';
import { HealthCheckResponse } from '@shared/types/health';

const router = Router();

// Healthcheck endpoint
router.get('/healthcheck', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = { status: 'OK from server', timestamp: new Date().toISOString() };
  res.status(200).json(response);
});

// Other core API endpoints
router.get('/core', (_req: Request, res: Response) => {
  res.json({ message: 'Core API Check is OK' });
});

export default router;