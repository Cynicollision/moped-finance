export interface IOwnedResourceData<T> {
    retrieveSingle(id: string): Promise<T | null>;
}
