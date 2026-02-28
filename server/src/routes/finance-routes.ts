import { Router, Request, Response } from 'express';
import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { createSuccessResponse, createSuccessMessageResponse } from './../utility/api-response-util';
import { FinanceLogic } from '../features/finance/finance-logic';

const router = Router();
const financeLogic = new FinanceLogic();

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
  const response = financeLogic.getFinanceProfile('1'); // TODO: get user ID from session/cache  -> finance profile ID
  res.status(200).json(response);
});

export default router;