import { BadRequestError } from './../../utility/errors';
import { IOwnedResourceData } from './base-resource-data';

export abstract class BaseResourceController {

    protected async validateOwnership<T>(userId: string, id: string, data: IOwnedResourceData<T>, resourceName: string): Promise<T> {
        const resource = await data.retrieveSingle(userId, id);

        if (!resource) {
            throw new BadRequestError(`${resourceName} not found or access denied for ID: ${id}`);
        }

        return resource;
    }
}
