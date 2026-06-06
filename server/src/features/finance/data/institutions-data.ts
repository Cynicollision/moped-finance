import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Institution } from '@shared/finance/types';
import { IOwnedResourceData } from '@core/interfaces';
import { DateTimeUtil } from '@core/utility';
import { institutionSchema } from './../schema/institution-schema';

export interface IFinanceInstitutionsData extends IOwnedResourceData<Institution> {
    retrieveAll(userId: string): Promise<Institution[]>;
    delete(userId: string, id: string): Promise<boolean>;
    insert(userId: string, institution: Institution): Promise<Institution>;
    update(userId: string, institution: Institution): Promise<Institution | null>;
}

function mapRowToInstitution(row: typeof institutionSchema.$inferSelect): Institution {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        name: row.name,
    };
}

export class FinanceInstitutionsData implements IFinanceInstitutionsData {
    constructor(private db: NodePgDatabase) {}
    
    public async retrieveAll(userId: string): Promise<Institution[]> {
        const rows = await this.db.select().from(institutionSchema)
            .where(eq(institutionSchema.userId, userId));

        return rows.map(mapRowToInstitution);
    }

    public async retrieveSingle(userId: string, id: string): Promise<Institution | null> {
        const rows = await this.db.select().from(institutionSchema)
            .where(and(eq(institutionSchema.userId, userId), eq(institutionSchema.id, id)));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToInstitution(rows[0]);
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const result = await this.db.delete(institutionSchema)
            .where(and(eq(institutionSchema.userId, userId), eq(institutionSchema.id, id)));

        return (result.rowCount ?? 0) > 0;
    }

    public async insert(userId: string, institution: Institution): Promise<Institution> {
        const rows = await this.db.insert(institutionSchema)
            .values({
                id: institution.id,
                userId: userId,
                name: institution.name,
            })
            .returning();

        return mapRowToInstitution(rows[0]);
    }

    public async update(userId: string, institution: Institution): Promise<Institution | null> {
        const rows = await this.db.update(institutionSchema)
            .set({
                name: institution.name,
                updatedAt: DateTimeUtil.now(),
            })
            .where(and(eq(institutionSchema.userId, userId), eq(institutionSchema.id, institution.id!)))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToInstitution(rows[0]);
    }
}