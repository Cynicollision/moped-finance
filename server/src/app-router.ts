import { Router, Request, Response } from 'express';
import { OperationResponse } from '@shared/types/common/operation-response';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';
import { createErrorResponse, createSuccessMessageResponse } from './utility/api-response-util';

const router = Router();

router.get('/healthcheck', (_req: Request, res: Response) => {
  const response = createSuccessMessageResponse('Health Check OK');
  res.status(200).json(response);
});

router.use('/finance', financeRoutes);
router.use('/grounds', groundsRoutes);

// Default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
  const response: OperationResponse = createErrorResponse('NOT_FOUND', `Route ${req.originalUrl} not found.`);
  res.status(404).json(response);
});

export default router;
