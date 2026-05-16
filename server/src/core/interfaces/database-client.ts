export interface IDatabaseResult<T = any> {
    rows: T[];
    rowCount: number | null;
}

export interface IDatabaseClient {
    query<T = any>(sql: string, params?: any[]): Promise<IDatabaseResult<T>>;
}
