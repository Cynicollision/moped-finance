import { ApiTokenAccess } from '@shared/core/enum';
import { User } from '@shared/core/types/user';

// Set by UserContext.setApiTokenUser for a request signed in with an API token (AUTH-11.6).
declare global {
    namespace Express {
        interface Request {
            user?: User;
            apiTokenAccess?: ApiTokenAccess;
        }
    }
}
