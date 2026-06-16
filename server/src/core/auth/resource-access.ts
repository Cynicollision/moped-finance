import { Entity } from "@shared/core/types";

export class ResourceAccess {
    static validate(userId: string, resource: Entity | null): boolean {
        return resource ? userId === resource.userId : false;
    }
}