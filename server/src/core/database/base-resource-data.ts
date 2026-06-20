export interface IOwnedResourceData<T> {
    retrieveSingle(id: string): Promise<T | null>;
    insert(resource: T): Promise<T>;
    update(resource: T): Promise<T | null>;
    delete(id: string): Promise<boolean>;
}
