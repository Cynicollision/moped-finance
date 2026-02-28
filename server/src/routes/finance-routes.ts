import { Router, Request, Response } from 'express';
import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { createSuccessResponse, createSuccessMessageResponse } from './../utility/api-response-util';
import { FinanceLogic } from './../logic/finance-logic';

const router = Router();
const financeLogic = new FinanceLogic();

router.get('/data/account', (_req: Request, res: Response) => {
  const response: OperationResponse<string> = createSuccessMessageResponse('Finance -> /data/account OK');
  res.status(200).json(response);
});

router.get('/data/institution', async (_req: Request, res: Response) => {
  const response = await financeLogic.getInstitutions('1');

  res.status(200).json(response);
});

router.get('/data/profile', async (req: Request, res: Response) => {
  const related = (req.query.related as string)?.split(',') || []; // TODO use or remove
  const response = await financeLogic.getFinanceProfile('1'); // TODO: get user ID from session/cache  -> finance profile ID
  res.status(200).json(response);
});

export default router;