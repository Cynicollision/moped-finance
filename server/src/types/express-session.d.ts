import 'express-session';
import { User } from '@shared/common/types/user';

declare module 'express-session' {
    interface SessionData {
        user?: User;
    }
}