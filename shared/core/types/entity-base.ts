export interface Entity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export type NewEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
