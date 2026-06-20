import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BudgetStream } from '@shared/finance/types';
import { IDatabaseClient } from '@server-core/db-client';
import { IOwnedResourceData } from '@server-core/interfaces';
import { DateTimeUtil } from '@server-core/utility';
import { budgetStreamSchema } from './budget-stream-schema';

export interface IFinanceBudgetStreamData extends IOwnedResourceData<BudgetStream> {
    retrieveAll(userId: string): Promise<BudgetStream[]>;
}

function mapRowToBudgetStream(row: typeof budgetStreamSchema.$inferSelect): BudgetStream {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        name: row.name,
        categoryId: row.categoryId ?? '',
        type: row.type as BudgetStream['type'],
        recurrence: row.recurrence as BudgetStream['recurrence'],
        amount: Number(row.amount),
    };
}

export class FinanceBudgetStreamData implements IFinanceBudgetStreamData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(userId: string): Promise<BudgetStream[]> {
        const rows = await this.db.select()
            .from(budgetStreamSchema)
            .where(eq(budgetStreamSchema.userId, userId));

        return rows.map(mapRowToBudgetStream);
    }

    public async retrieveSingle(id: string): Promise<BudgetStream | null> {
        const rows = await this.db.select()
            .from(budgetStreamSchema)
            .where(eq(budgetStreamSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToBudgetStream(rows[0]);
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db.delete(budgetStreamSchema)
            .where(eq(budgetStreamSchema.id, id))
            .returning({ id: budgetStreamSchema.id });

        return result.length > 0;
    }

    public async insert(stream: BudgetStream): Promise<BudgetStream> {
        const rows = await this.db.insert(budgetStreamSchema)
            .values({
                id: stream.id,
                userId: stream.userId,
                name: stream.name,
                categoryId: stream.categoryId,
                type: stream.type,
                recurrence: stream.recurrence,
                amount: String(stream.amount),
            })
            .returning();

        return mapRowToBudgetStream(rows[0]);
    }

    public async update(stream: BudgetStream): Promise<BudgetStream | null> {
        const rows = await this.db.update(budgetStreamSchema)
            .set({
                name: stream.name,
                categoryId: stream.categoryId,
                type: stream.type,
                recurrence: stream.recurrence,
                amount: String(stream.amount),
                updatedAt: DateTimeUtil.now(),
            })
            .where(eq(budgetStreamSchema.id, stream.id!))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToBudgetStream(rows[0]);
    }
}