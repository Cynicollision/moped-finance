import 'express-session';
import { User } from '@shared/types/core/entities/user';

declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}