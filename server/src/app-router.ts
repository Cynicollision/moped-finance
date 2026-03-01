import { Router, Request, Response } from 'express';
import { OperationResultFactory } from './utility/operation-result-factory';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';

const router = Router();

router.get('/healthcheck', (_req: Request, res: Response) => {
  const response = OperationResultFactory.success('Health Check OK');
  res.status(200).json(response);
});

router.use('/finance', financeRoutes);
router.use('/grounds', groundsRoutes);

// Default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
  const result = OperationResultFactory.error('NOT_FOUND', `Route ${req.originalUrl} not found.`);
  res.status(404).json(result);
});

export default router;
