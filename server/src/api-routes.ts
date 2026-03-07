import { Router, Request, Response } from 'express';
import { resolveUser, requireAuth } from './middleware/auth-middleware';
import { ApiHandler } from './routes/api-handler';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';

const router = Router();

// healthcheck
router.get('/healthcheck', (_req: Request, res: Response) => {
    return ApiHandler.succeed(res, 'OK');
});

// feature API routes
router.use('/finance', resolveUser, requireAuth, financeRoutes);
router.use('/grounds', resolveUser, requireAuth, groundsRoutes);

// default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
    return ApiHandler.failNotFound(req, res);
});

export default router;
