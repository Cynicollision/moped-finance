import 'express-session';
import { User } from '@shared/types/entities/core/user';

declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}