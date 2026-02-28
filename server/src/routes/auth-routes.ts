import { Router, Request, Response } from 'express';
import { User } from '@shared/types/core/entities/user';
import { createSuccessResponse, createSuccessMessageResponse, createErrorResponse } from './../utility/api-response-util';

const router = Router();

export interface AuthRequest {
  username: string;
  password?: string;
}

router.post('/login', (req: Request, res: Response) => {
  const { username } = req.body as AuthRequest;

  // Hardcoded user for now
  const user: User = {
    id: '1',
    username: username,
    name: username
  };

  req.session.user = user;

  res.json(createSuccessResponse(user));
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json(createErrorResponse('LOGOUT_ERROR', 'Could not log out.'));
    }
    res.clearCookie('connect.sid');
    res.json(createSuccessMessageResponse('Logged out successfully'));
  });
});

router.get('/me', (req: Request, res: Response) => {
  const user = req.session.user;

  if (!user) {
    return res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Not authenticated'));
  }

  res.json(createSuccessResponse(user));
});

export default router;