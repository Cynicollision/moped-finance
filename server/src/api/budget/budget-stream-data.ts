import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarPeriod } from '@shared/core/enum';
import { BudgetStreamType } from '@shared/finance/enum';
import { BudgetStream } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { budgetStreamSchema } from './budget-stream-schema';

export interface IFinanceBudgetStreamData {
    retrieveAll(): Promise<BudgetStream[]>;
    retrieveSingle(id: string): Promise<BudgetStream | null>;
    insert(stream: BudgetStream): Promise<BudgetStream>;
    update(stream: BudgetStream): Promise<BudgetStream | null>;
    delete(id: string): Promise<boolean>;
}

function mapRowToBudgetStream(row: typeof budgetStreamSchema.$inferSelect): BudgetStream {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.name,
        categoryId: row.categoryId ?? '',
        type: row.type as BudgetStreamType,
        recurrence: row.recurrence as CalendarPeriod,
        amount: Number(row.amount),
    };
}

export class FinanceBudgetStreamData implements IFinanceBudgetStreamData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(): Promise<BudgetStream[]> {
        const rows = await this.db.select()
            .from(budgetStreamSchema);

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