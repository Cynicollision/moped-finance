import { Router, Request, Response } from 'express';
import { OperationResponse } from '@shared/types/common/operation-response';
import { createSuccessMessageResponse } from './../utility/api-response-util';

const router = Router();

router.get('/composite/today', (_req: Request, res: Response) => {
  const response: OperationResponse<string> = createSuccessMessageResponse('Grounds -> /composite/today OK');
  res.status(200).json(response);
});

export default router;