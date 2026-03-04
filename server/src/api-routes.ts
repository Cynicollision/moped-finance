import { Router, Request, Response } from 'express';
import financeRoutes from './features/finance/finance-routes';
import groundsRoutes from './features/grounds/grounds-routes';

const router = Router();

router.get('/healthcheck', (_req: Request, res: Response) => {
    res.status(200);
});

router.use('/finance', financeRoutes);
router.use('/grounds', groundsRoutes);

// Default 404 handler for unmatched API routes
router.all('*', (req: Request, res: Response) => {
    res.status(404).json(`Route ${req.originalUrl} not found.`);
});

export default router;
