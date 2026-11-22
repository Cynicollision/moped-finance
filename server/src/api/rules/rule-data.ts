import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
    CategorySource,
    RuleActionType,
    RuleConditionField,
    RuleOperator,
    TransactionDirection
} from '@shared/finance/enum';
import { Rule, RuleAction, RuleCondition } from '@shared/finance/types';
import { DbTransaction, EntityId, FinanceEntityIdPrefix, IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { categorySchema } from './../categories/category-schema';
import { transactionSchema } from './../transactions/transaction-schema';
import { ExistingTransaction, RuleApplyPlan, RuleEngine } from './rule-engine';
import { ruleActionSchema, ruleConditionSchema, ruleSchema } from './rule-schema';

export interface IRuleData {
    /** In list order (CAT-8.3). */
    retrieveAll(): Promise<Rule[]>;
    retrieveSingle(id: string): Promise<Rule | null>;
    /** The rules and inactive categories, ready to apply. */
    loadEngine(): Promise<RuleEngine>;
    /** The categories that are inactive, whose Set category rules skip (CAT-8.1). */
    retrieveInactiveCategoryIds(): Promise<Set<string>>;
    /** Every unsplit transaction, as a rule's Apply to existing matches them (CAT-8.5, CAT-8.7). */
    retrieveExistingTransactions(): Promise<ExistingTransaction[]>;
    /** Adds the rule at the end of the list. */
    insert(rule: Rule): Promise<Rule>;
    /** Saves its name, conditions and actions. Null when it doesn't exist. */
    update(rule: Rule): Promise<Rule | null>;
    delete(id: string): Promise<boolean>;
    /** Puts the rules in the order of their IDs, which must be every rule's. */
    reorder(ids: string[]): Promise<void>;
    /**
     * Applies one rule's plan to the existing transactions (CAT-8.5), in one database transaction, skipping any that was
     * categorized or split since the plan was made.
     */
    apply(rule: Rule, plan: RuleApplyPlan): Promise<void>;
}

type ConditionRow = typeof ruleConditionSchema.$inferSelect;
type ActionRow = typeof ruleActionSchema.$inferSelect;

function mapRowToCondition(row: ConditionRow): RuleCondition {
    switch (row.field as RuleConditionField) {
        case RuleConditionField.Amount:
            return {
                field: RuleConditionField.Amount,
                operator: row.operator as RuleOperator.GreaterThan | RuleOperator.LessThan | RuleOperator.Equals,
                direction: row.direction as TransactionDirection,
                amount: row.amountValue!
            };
        case RuleConditionField.Account:
            return { field: RuleConditionField.Account, accountId: row.accountId! };
        default:
            return {
                field: row.field as RuleConditionField.OriginalStatement | RuleConditionField.Merchant,
                operator: row.operator as RuleOperator.Contains | RuleOperator.Equals,
                text: row.textValue!
            };
    }
}

function mapConditionToRow(ruleId: string, condition: RuleCondition, position: number): ConditionRow {
    const row: ConditionRow = {
        id: EntityId.generate(FinanceEntityIdPrefix.RuleCondition),
        ruleId,
        position,
        field: condition.field,
        // An account condition is always *is*.
        operator: RuleOperator.Equals,
        textValue: null,
        amountValue: null,
        direction: null,
        accountId: null
    };
    switch (condition.field) {
        case RuleConditionField.Amount:
            return {
                ...row,
                operator: condition.operator,
                amountValue: condition.amount,
                direction: condition.direction
            };
        case RuleConditionField.Account:
            return { ...row, accountId: condition.accountId };
        default:
            return { ...row, operator: condition.operator, textValue: condition.text };
    }
}

function mapRowToAction(row: ActionRow): RuleAction {
    return row.type === RuleActionType.SetCategory
        ? { type: RuleActionType.SetCategory, categoryId: row.categoryId! }
        : { type: RuleActionType.RenameMerchant, merchant: row.textValue! };
}

function mapActionToRow(ruleId: string, action: RuleAction, position: number): ActionRow {
    return {
        id: EntityId.generate(FinanceEntityIdPrefix.RuleAction),
        ruleId,
        position,
        type: action.type,
        categoryId: action.type === RuleActionType.SetCategory ? action.categoryId : null,
        textValue: action.type === RuleActionType.RenameMerchant ? action.merchant : null
    };
}

/** The rules, in list order, with their conditions and actions in the order the user gave them. */
async function selectRules(db: NodePgDatabase | DbTransaction, id?: string): Promise<Rule[]> {
    const [rules, conditions, actions] = await Promise.all([
        db
            .select()
            .from(ruleSchema)
            .where(id ? eq(ruleSchema.id, id) : undefined)
            .orderBy(asc(ruleSchema.position), asc(ruleSchema.id)),
        db
            .select()
            .from(ruleConditionSchema)
            .where(id ? eq(ruleConditionSchema.ruleId, id) : undefined)
            .orderBy(asc(ruleConditionSchema.position)),
        db
            .select()
            .from(ruleActionSchema)
            .where(id ? eq(ruleActionSchema.ruleId, id) : undefined)
            .orderBy(asc(ruleActionSchema.position))
    ]);
    return rules.map(row => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: row.name,
        position: row.position,
        conditions: conditions.filter(c => c.ruleId === row.id).map(mapRowToCondition),
        actions: actions.filter(a => a.ruleId === row.id).map(mapRowToAction)
    }));
}

async function insertConditionsAndActions(tx: DbTransaction, rule: Rule): Promise<void> {
    await tx.insert(ruleConditionSchema).values(rule.conditions.map((c, i) => mapConditionToRow(rule.id!, c, i)));
    await tx.insert(ruleActionSchema).values(rule.actions.map((a, i) => mapActionToRow(rule.id!, a, i)));
}

async function selectInactiveCategoryIds(db: NodePgDatabase | DbTransaction): Promise<Set<string>> {
    const rows = await db
        .select({ id: categorySchema.id })
        .from(categorySchema)
        .where(eq(categorySchema.isActive, false));
    return new Set(rows.map(row => row.id));
}

/**
 * The rules and inactive categories, ready to apply. Takes a database transaction, so an import or sync loads them
 * once, inside its own.
 */
export async function loadRuleEngine(db: NodePgDatabase | DbTransaction): Promise<RuleEngine> {
    const [rules, inactiveCategoryIds] = await Promise.all([selectRules(db), selectInactiveCategoryIds(db)]);
    return new RuleEngine(rules, inactiveCategoryIds);
}

// Updates name a set of transactions by ID; chunked to stay under Postgres's bind-parameter limit.
const chunkSize = 1000;

export class RuleData implements IRuleData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(): Promise<Rule[]> {
        return selectRules(this.db);
    }

    public async retrieveSingle(id: string): Promise<Rule | null> {
        const [rule] = await selectRules(this.db, id);
        return rule ?? null;
    }

    public async loadEngine(): Promise<RuleEngine> {
        return loadRuleEngine(this.db);
    }

    public async retrieveInactiveCategoryIds(): Promise<Set<string>> {
        return selectInactiveCategoryIds(this.db);
    }

    public async retrieveExistingTransactions(): Promise<ExistingTransaction[]> {
        const rows = await this.db
            .select({
                id: transactionSchema.id,
                accountId: transactionSchema.accountId,
                amount: transactionSchema.amount,
                merchant: transactionSchema.merchant,
                originalStatement: transactionSchema.originalStatement,
                categoryId: transactionSchema.categoryId
            })
            .from(transactionSchema)
            .where(isNull(transactionSchema.splitId));
        return rows.map(row => ({
            ...row,
            amount: Number(row.amount),
            originalStatement: row.originalStatement ?? '',
            categoryId: row.categoryId ?? '',
            splitId: ''
        }));
    }

    public async insert(rule: Rule): Promise<Rule> {
        return this.db.transaction(async tx => {
            const [last] = await tx.select({ position: max(ruleSchema.position) }).from(ruleSchema);
            await tx.insert(ruleSchema).values({
                id: rule.id,
                name: rule.name,
                position: (last?.position ?? -1) + 1
            });
            await insertConditionsAndActions(tx, rule);
            const [inserted] = await selectRules(tx, rule.id);
            return inserted;
        });
    }

    public async update(rule: Rule): Promise<Rule | null> {
        return this.db.transaction(async tx => {
            const rows = await tx
                .update(ruleSchema)
                .set({ name: rule.name, updatedAt: DateTimeUtil.now() })
                .where(eq(ruleSchema.id, rule.id!))
                .returning({ id: ruleSchema.id });
            if (rows.length === 0) {
                return null;
            }
            await tx.delete(ruleConditionSchema).where(eq(ruleConditionSchema.ruleId, rule.id!));
            await tx.delete(ruleActionSchema).where(eq(ruleActionSchema.ruleId, rule.id!));
            await insertConditionsAndActions(tx, rule);
            const [updated] = await selectRules(tx, rule.id);
            return updated;
        });
    }

    public async delete(id: string): Promise<boolean> {
        const rows = await this.db.delete(ruleSchema).where(eq(ruleSchema.id, id)).returning({ id: ruleSchema.id });
        return rows.length > 0;
    }

    public async reorder(ids: string[]): Promise<void> {
        await this.db.transaction(async tx => {
            for (const [position, id] of ids.entries()) {
                await tx.update(ruleSchema).set({ position }).where(eq(ruleSchema.id, id));
            }
        });
    }

    public async apply(rule: Rule, plan: RuleApplyPlan): Promise<void> {
        const setCategory = rule.actions.find(a => a.type === RuleActionType.SetCategory);
        const rename = rule.actions.find(a => a.type === RuleActionType.RenameMerchant);
        await this.db.transaction(async tx => {
            for (let i = 0; setCategory && i < plan.categorize.length; i += chunkSize) {
                await tx
                    .update(transactionSchema)
                    .set({
                        categoryId: setCategory.categoryId,
                        categorySource: CategorySource.Rule,
                        categoryRuleId: rule.id,
                        updatedAt: DateTimeUtil.now()
                    })
                    .where(
                        and(
                            inArray(transactionSchema.id, plan.categorize.slice(i, i + chunkSize)),
                            isNull(transactionSchema.categoryId),
                            isNull(transactionSchema.splitId)
                        )
                    );
            }
            for (let i = 0; rename && i < plan.rename.length; i += chunkSize) {
                await tx
                    .update(transactionSchema)
                    .set({ merchant: rename.merchant, merchantRuleId: rule.id, updatedAt: DateTimeUtil.now() })
                    .where(
                        and(
                            inArray(transactionSchema.id, plan.rename.slice(i, i + chunkSize)),
                            isNull(transactionSchema.splitId)
                        )
                    );
            }
        });
    }
}
