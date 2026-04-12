import { Router, Request, Response } from 'express';
import { ApiUtil } from './routes/api-util';
import { resolveUser, requireAuth } from './routes/auth-middleware';
import financeRoutes from './routes/finance-routes';
import groundsRoutes from './routes/grounds-routes';

const router = Router();

// healthcheck
router.get('/healthcheck', (_req: Request, res: Response) => {
    return ApiUtil.success(res, 'OK');
});

// feature API routes
router.use('/finance', resolveUser, requireAuth, financeRoutes);
router.use('/grounds', resolveUser, requireAuth, groundsRoutes);

// default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
    return ApiUtil.notFound(req, res);
});

export default router;
