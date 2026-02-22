import { Router, Request, Response } from 'express';
import { ApiResponse } from '@shared/types/common/api';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';
import { createErrorResponse, createSuccessResponse } from './utility/api-response-util';

const router = Router();

router.get('/healthcheck', (_req: Request, res: Response) => {
  const response = createSuccessResponse('Health Check OK');
  res.status(200).json(response);
});

router.use('/finance', financeRoutes);
router.use('/grounds', groundsRoutes);

// Default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
  const response: ApiResponse = createErrorResponse('NOT_FOUND', `Route ${req.originalUrl} not found.`);
  res.status(404).json(response);
});

export default router;
