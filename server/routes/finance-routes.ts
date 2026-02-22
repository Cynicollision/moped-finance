import { Router, Request, Response } from 'express';
import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { createSuccessResponse, createSuccessMessageResponse } from './../utility/api-response-util';
import { FinanceLogic } from './../logic';

const financeLogic = new FinanceLogic();
const router = Router();

router.get('/data/account', (_req: Request, res: Response) => {
  const response: OperationResponse<string> = createSuccessMessageResponse('Finance -> /data/account OK');
  res.status(200).json(response);
});

router.get('/data/institution', (_req: Request, res: Response) => {
  const response = financeLogic.getTestInstitutions();

  res.status(200).json(response);
});

router.get('/data/profile', (req: Request, res: Response) => {
  const related = (req.query.related as string)?.split(',') || [];
  const response: OperationResponse<string> = createSuccessMessageResponse(`Finance -> /data/profile OK (Related: ${related.join(', ')})`);
  res.status(200).json(response);
});

export default router;