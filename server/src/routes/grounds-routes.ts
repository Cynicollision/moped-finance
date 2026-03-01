import { Router, Request, Response } from 'express';
import { OperationResult } from '@shared/types/common/operation-response';
import { OperationResultFactory } from '../utility/operation-result-factory';

const router = Router();

router.get('/composite/today', (_req: Request, res: Response) => {
  const response = OperationResultFactory.success('Grounds -> /composite/today OK');
  res.status(200).json(response);
});

export default router;