import { Router, Request, Response } from 'express';
import { ApiResponse } from '@shared/types/common/api';
import { createSuccessResponse } from './../utility/api-response-util';

const router = Router();

router.get('/composite/today', (_req: Request, res: Response) => {
  const response: ApiResponse<string> = createSuccessResponse('Grounds -> /composite/today OK');
  res.status(200).json(response);
});

export default router;