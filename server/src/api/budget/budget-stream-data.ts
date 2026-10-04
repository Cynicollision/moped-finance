import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CalendarPeriod } from '@shared/core/enum';
import { CategoryType } from '@shared/finance/enum';
import { BudgetStream, BudgetStreamFields } from '@shared/finance/types';
import { BudgetStreamUtil } from '@shared/finance/util';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { budgetStreamSchema } from './budget-stream-schema';
import { categoryGroupSchema } from './../categories/category-groups/category-group-schema';
import { categorySchema } from './../categories/category-schema';

export interface IFinanceBudgetStreamData {
    retrieveAll(): Promise<BudgetStream[]>;
    retrieveSingle(id: string): Promise<BudgetStream | null>;
    insert(stream: BudgetStreamFields): Promise<BudgetStream>;
    update(stream: BudgetStreamFields): Promise<BudgetStream | null>;
    delete(id: string): Promise<boolean>;
}

function mapRowToBudgetStream(row: typeof budgetStreamSchema.$inferSelect, categoryType: string): BudgetStream {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.name,
        categoryId: row.categoryId,
        type: BudgetStreamUtil.typeOf(categoryType as CategoryType),
        recurrence: row.recurrence as CalendarPeriod,
        amount: Number(row.amount)
    };
}

export class FinanceBudgetStreamData implements IFinanceBudgetStreamData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    // Each stream with its category's type, which decides the stream's type (BUD-1.1).
    private selectWithCategoryType() {
        return this.db
            .select({ stream: budgetStreamSchema, categoryType: categoryGroupSchema.type })
            .from(budgetStreamSchema)
            .innerJoin(categorySchema, eq(categorySchema.id, budgetStreamSchema.categoryId))
            .innerJoin(categoryGroupSchema, eq(categoryGroupSchema.id, categorySchema.groupId));
    }

    public async retrieveAll(): Promise<BudgetStream[]> {
        const rows = await this.selectWithCategoryType();

        return rows.map(row => mapRowToBudgetStream(row.stream, row.categoryType));
    }

    public async retrieveSingle(id: string): Promise<BudgetStream | null> {
        const rows = await this.selectWithCategoryType().where(eq(budgetStreamSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToBudgetStream(rows[0].stream, rows[0].categoryType);
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(budgetStreamSchema)
            .where(eq(budgetStreamSchema.id, id))
            .returning({ id: budgetStreamSchema.id });

        return result.length > 0;
    }

    public async insert(stream: BudgetStreamFields): Promise<BudgetStream> {
        await this.db.insert(budgetStreamSchema).values({
            id: stream.id,
            name: stream.name,
            categoryId: stream.categoryId,
            recurrence: stream.recurrence,
            amount: String(stream.amount)
        });

        // Read back through the category, for the type.
        return (await this.retrieveSingle(stream.id))!;
    }

    public async update(stream: BudgetStreamFields): Promise<BudgetStream | null> {
        const rows = await this.db
            .update(budgetStreamSchema)
            .set({
                name: stream.name,
                categoryId: stream.categoryId,
                recurrence: stream.recurrence,
                amount: String(stream.amount),
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(budgetStreamSchema.id, stream.id))
            .returning({ id: budgetStreamSchema.id });

        if (rows.length === 0) {
            return null;
        }

        return this.retrieveSingle(stream.id);
    }
}
