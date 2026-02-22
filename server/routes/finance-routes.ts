import { Router, Request, Response } from 'express';
import { ApiResponse } from '@shared/types/common/api';
import { createSuccessResponse } from './../utility/api-response-util';

const router = Router();

router.get('/data/account', (_req: Request, res: Response) => {
  const response: ApiResponse<string> = createSuccessResponse('Finance -> /data/account OK');
  res.status(200).json(response);
});

router.get('/data/profile', (req: Request, res: Response) => {
  const related = (req.query.related as string)?.split(',') || [];
  const response: ApiResponse<string> = createSuccessResponse(`Finance -> /data/profile OK (Related: ${related.join(', ')})`);
  res.status(200).json(response);
});

export default router;