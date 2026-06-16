import { Entity } from "@shared/core/types";

export abstract class FinanceController {

    // TODO: utility class? @server-core/auth/access-service ?
    protected hasResourceAccess(userId: string, resource: Entity | null): boolean {
        return resource ? userId === resource.userId : false;
    }
}