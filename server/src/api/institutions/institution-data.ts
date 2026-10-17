import { asc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Institution } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { institutionSchema } from './institution-schema';

export interface IInstitutionData {
    retrieveAll(): Promise<Institution[]>;
    retrieveSingle(id: string): Promise<Institution | null>;
    insert(institution: Institution): Promise<Institution>;
    update(institution: Institution): Promise<Institution | null>;
    delete(id: string): Promise<boolean>;
}

function mapRowToInstitution(row: typeof institutionSchema.$inferSelect): Institution {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.name
    };
}

export class InstitutionData implements IInstitutionData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(): Promise<Institution[]> {
        // By name, ignoring case (INST-1.1).
        const rows = await this.db
            .select()
            .from(institutionSchema)
            .orderBy(asc(sql`lower(${institutionSchema.name})`));

        return rows.map(mapRowToInstitution);
    }

    public async retrieveSingle(id: string): Promise<Institution | null> {
        const rows = await this.db.select().from(institutionSchema).where(eq(institutionSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToInstitution(rows[0]);
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(institutionSchema)
            .where(eq(institutionSchema.id, id))
            .returning({ id: institutionSchema.id });

        return result.length > 0;
    }

    public async insert(institution: Institution): Promise<Institution> {
        const rows = await this.db
            .insert(institutionSchema)
            .values({
                id: institution.id,
                name: institution.name
            })
            .returning();

        return mapRowToInstitution(rows[0]);
    }

    public async update(institution: Institution): Promise<Institution | null> {
        const rows = await this.db
            .update(institutionSchema)
            .set({
                name: institution.name,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(institutionSchema.id, institution.id!))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToInstitution(rows[0]);
    }
}
