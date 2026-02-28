import { Request, Response } from 'express';
import { User } from '@shared/types/core/entities/user';
import { OperationResponse } from '@shared/types/common/operation-response';
import { createErrorResponse } from './api-response-util';

export class AuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

function getAuthenticatedUser(req: Request): User {
  if (!req.session?.user) {
    throw new AuthenticationError();
  }
  return req.session.user;
}

export async function handleAuthenticatedRequest<T>(req: Request, res: Response,
  action: (user: User) => Promise<OperationResponse<T>>
): Promise<void> {
  try {
    const user = getAuthenticatedUser(req);
    const response = await action(user);
    res.status(200).json(response);
  }
  catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json(createErrorResponse('UNAUTHORIZED', error.message));
    } else {
      console.error(error);
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  }
}