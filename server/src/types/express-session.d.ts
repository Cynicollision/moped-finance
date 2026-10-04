import 'express-session';
import { User } from '@shared/core/types/user';

declare module 'express-session' {
    interface SessionData {
        user?: User;
    }
}
