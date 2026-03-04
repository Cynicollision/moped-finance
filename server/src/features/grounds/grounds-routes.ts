import { Router, Request, Response } from 'express';

const router = Router();

router.get('/composite/today', (_req: Request, res: Response) => {
    res.status(200).json('Grounds -> /composite/today OK');
});

export default router;