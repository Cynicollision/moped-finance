export interface IOwnedResourceData<T> {
    retrieveSingle(userId: string, id: string): Promise<T | null>;
}
