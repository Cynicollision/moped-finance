import { Router, Request, Response } from 'express';
import { OperationResultFactory } from '../utility/operation-result-factory';
import { ApiResponseHandler } from './../utility/api-response-handler';
import { AuthLogic, AuthRequest } from './../logic/auth-logic';

const router = Router();
const authLogic = new AuthLogic();

router.post('/login', async (req: Request, res: Response) => {
  // TODO: cleanup type usage
  const { username } = req.body as AuthRequest;

  const result = await authLogic.login(username);
  req.session.user = result.data;

  return ApiResponseHandler.succeed(res, result);
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json(OperationResultFactory.error('LOGOUT_ERROR', 'Could not log out.'));
    }
    res.clearCookie('connect.sid');
    res.json(OperationResultFactory.success('Logged out successfully'));
  });
});

router.get('/me', (req: Request, res: Response) => {
  const user = req.session.user;

  if (!user) {
    // TODO: is 401 correct here? Or 200 w/ success = false for more graceful handling on client?
    return res.status(401).json(OperationResultFactory.error('UNAUTHORIZED', 'Not authenticated'));
  }

  res.json(OperationResultFactory.success(user));
});

export default router;