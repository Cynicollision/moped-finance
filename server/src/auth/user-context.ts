import { Request } from 'express';
import { ApiTokenAccess } from '@shared/core/enum';
import { User } from '@shared/core/types';

export class UserContext {

    private static readonly anonymousUserId = 'anonymous';

    private constructor(private req: Request) { }

    static fromRequest(req: Request): UserContext {
        return new UserContext(req);
    }

    /** Signs this request in with an API token (AUTH-11.6). Nothing is stored in the session. */
    static setApiTokenUser(req: Request, user: User, access: ApiTokenAccess): void {
        (req as any).user = user;
        (req as any).apiTokenAccess = access;
    }

    public getUser(): User | undefined {
        // An API token takes precedence over the session (AUTH-11.7)
        if ((this.req as any).user) {
            return (this.req as any).user;
        }

        return this.req.session?.user;
    }

    /** The access of the API token this request was signed in with, or undefined for a browser session. */
    public getApiTokenAccess(): ApiTokenAccess | undefined {
        return (this.req as any).apiTokenAccess;
    }

    public getId(): string {
        const user = this.getUser();
        const userId = user?.id || UserContext.anonymousUserId;
        return userId;
    }
}
