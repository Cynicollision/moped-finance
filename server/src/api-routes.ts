import { Router, Request, Response } from 'express';
import { requireAuth } from './middleware/auth-middleware';
import { ApiHandler } from './routes/api-handler';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';

const router = Router();

router.get('/healthcheck', (_req: Request, res: Response) => {
    return ApiHandler.succeed(res, 'OK');
});

router.use('/finance', requireAuth, financeRoutes);
router.use('/grounds', requireAuth, groundsRoutes);

// Default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
    return ApiHandler.failNotFound(req, res);
});

export default router;
