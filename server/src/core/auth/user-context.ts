import { Request } from 'express';
import { Entity, User } from '@shared/core/types';

export class UserContext {

    private static readonly anonymousUserId = 'anonymous';

    private constructor(private req: Request) { }

    static fromRequest(req: Request): UserContext {
        return new UserContext(req);
    }

    public canAccess(resource: Entity | null): boolean {
        return resource ? this.getId() === resource.userId : false;
    }

    public getUser(): User | undefined {
        if (this.req.session?.user) {
            return this.req.session.user;
        }

        // Check if user was already resolved and attached to request (e.g. by middleware)
        if ((this.req as any).user) {
            return (this.req as any).user;
        }

        return undefined;
    }

    public getId(): string {
        const user = this.getUser();
        const userId = user?.id || UserContext.anonymousUserId;
        return userId;
    }
}
