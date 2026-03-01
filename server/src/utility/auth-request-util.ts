import { Request } from 'express';
import { User } from '@shared/types/core/entities/user';

export class AuthenticationError extends Error {
  constructor(message: string = 'User not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export function getAuthenticatedUser(req: Request): User {
  if (!req.session?.user) {
    throw new AuthenticationError();
  }
  return req.session.user;
}