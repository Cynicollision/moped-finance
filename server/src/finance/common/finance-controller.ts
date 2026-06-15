import { Entity } from "@shared/core/types";

export abstract class FinanceController {

    protected hasResourceAccess(userId: string, resource: Entity): boolean {
        return resource ? userId === resource.userId : false;
    }
}