import { Entity } from "@shared/core/types";

export abstract class FinanceController {

    protected userOwnsResource(userId: string, resource: Entity): boolean {
        //return resource.userId === userId;
        // TODO - add userId to Entity and all Finance tables?
        return true;
    }
}