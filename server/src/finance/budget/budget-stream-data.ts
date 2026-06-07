import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BudgetStream } from '@shared/finance/types';
import { IOwnedResourceData } from '@core/interfaces';
import { DateTimeUtil } from '@core/utility';
import { budgetStreamSchema } from './budget-stream-schema';

export interface IFinanceBudgetStreamData extends IOwnedResourceData<BudgetStream> {
    retrieveAll(userId: string): Promise<BudgetStream[]>;
    retrieveSingle(userId: string, id: string): Promise<BudgetStream | null>;
    delete(userId: string, id: string): Promise<boolean>;
    insert(userId: string, stream: BudgetStream): Promise<BudgetStream>;
    update(userId: string, stream: BudgetStream): Promise<BudgetStream | null>;
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

    constructor(db: NodePgDatabase) {
        this.db = db;
    }

    public async retrieveAll(userId: string): Promise<BudgetStream[]> {
        const rows = await this.db.select().from(budgetStreamSchema)
            .where(eq(budgetStreamSchema.userId, userId));

        return rows.map(mapRowToBudgetStream);
    }

    public async retrieveSingle(userId: string, id: string): Promise<BudgetStream | null> {
        const rows = await this.db.select().from(budgetStreamSchema)
            .where(and(eq(budgetStreamSchema.userId, userId), eq(budgetStreamSchema.id, id)));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToBudgetStream(rows[0]);
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const result = await this.db.delete(budgetStreamSchema)
            .where(and(eq(budgetStreamSchema.userId, userId), eq(budgetStreamSchema.id, id)));

        return (result.rowCount ?? 0) > 0;
    }

    public async insert(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        const rows = await this.db.insert(budgetStreamSchema)
            .values({
                id: stream.id,
                userId: userId,
                name: stream.name,
                categoryId: stream.categoryId,
                type: stream.type,
                recurrence: stream.recurrence,
                amount: String(stream.amount),
            })
            .returning();

        return mapRowToBudgetStream(rows[0]);
    }

    public async update(userId: string, stream: BudgetStream): Promise<BudgetStream | null> {
        const rows = await this.db.update(budgetStreamSchema)
            .set({
                name: stream.name,
                categoryId: stream.categoryId,
                type: stream.type,
                recurrence: stream.recurrence,
                amount: String(stream.amount),
                updatedAt: DateTimeUtil.now(),
            })
            .where(and(eq(budgetStreamSchema.id, stream.id!), eq(budgetStreamSchema.userId, userId)))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToBudgetStream(rows[0]);
    }
}