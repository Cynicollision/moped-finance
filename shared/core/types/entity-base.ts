export type Entity = {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
};

export type NewEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { id?: string };
