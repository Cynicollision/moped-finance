import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import {
    AccountType,
    CategorySource,
    CategoryType,
    RuleActionType,
    RuleConditionField,
    RuleOperator,
    TransactionDirection
} from '@shared/finance/enum';
import { RuleRequest, RuleTextCondition, Transaction } from '@shared/finance/types';
import { DatabaseClient, EntityFactory } from '@server/data';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { AccountData, BalanceHistoryData, createAccountRouter } from './../accounts';
import { CategoryData, CategoryGroupData, createCategoryRouter } from './../categories';
import { InstitutionData } from './../institutions';
import { TransactionData } from './../transactions/transaction-data';
import { RuleData } from './rule-data';
import { createRuleRouter } from './rule-routes';

describe('Rule Routes', () => {
    let app: express.Express;
    let categoriesApp: express.Express;
    let accountsApp: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let ruleData: RuleData;
    let transactionData: TransactionData;
    let categoryData: CategoryData;
    let groupData: CategoryGroupData;
    let accountData: AccountData;
    let institutionData: InstitutionData;

    let accountId: string;
    let groupId: string;
    let coffeeId: string;
    let diningId: string;

    beforeAll(async () => {
        ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
        const user = await TestDatabaseUtil.createTestUser(dbClient);
        const logger = TestExpressUtil.createMockLogger();

        ruleData = new RuleData(dbClient);
        transactionData = new TransactionData(dbClient);
        categoryData = new CategoryData(dbClient);
        groupData = new CategoryGroupData(dbClient);
        accountData = new AccountData(dbClient);
        institutionData = new InstitutionData(dbClient);

        app = TestExpressUtil.createTestApp(createRuleRouter(logger, ruleData, categoryData), '/rules', user.id);
        categoriesApp = TestExpressUtil.createTestApp(
            createCategoryRouter(logger, categoryData, groupData),
            '/categories',
            user.id
        );
        accountsApp = TestExpressUtil.createTestApp(
            createAccountRouter(logger, accountData, new BalanceHistoryData(dbClient), transactionData),
            '/accounts',
            user.id
        );
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);

        const institution = await institutionData.insert(EntityFactory.createInstitution({ name: 'Bank' }));
        const account = await accountData.insert(
            EntityFactory.createAccount({
                institutionId: institution.id!,
                name: 'Checking',
                type: AccountType.Checking,
                isHidden: false,
                balance: 0
            })
        );
        accountId = account.id!;

        const group = await groupData.insert(
            EntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Food' })
        );
        groupId = group.id!;
        coffeeId = (await insertCategory('Coffee')).id!;
        diningId = (await insertCategory('Dining')).id!;
    });

    function insertCategory(name: string, isActive = true) {
        return categoryData.insert(EntityFactory.createCategory({ groupId, name, icon: '', isActive }));
    }

    function insertTransaction(fields: Partial<Transaction> = {}): Promise<Transaction> {
        return transactionData.insert(
            EntityFactory.createTransaction({
                accountId,
                categoryId: '',
                date: '2026-11-01',
                amount: -4.5,
                merchant: 'SQ *BLUE BOTTLE 1234',
                originalStatement: 'SQ *BLUE BOTTLE 1234 OAKLAND CA',
                notes: '',
                isHidden: false,
                ...fields
            })
        );
    }

    function coffeeRule(fields: Partial<RuleRequest> = {}): RuleRequest {
        return {
            name: 'Blue Bottle',
            conditions: [
                { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: 'blue bottle' }
            ],
            actions: [
                { type: RuleActionType.SetCategory, categoryId: coffeeId },
                { type: RuleActionType.RenameMerchant, merchant: 'Blue Bottle' }
            ],
            ...fields
        };
    }

    async function createRule(fields: Partial<RuleRequest> = {}): Promise<string> {
        const response = await request(app).post('/rules').send(coffeeRule(fields));
        expect(response.status).toBe(201);
        return response.body.id;
    }

    describe('POST /', () => {
        it('CAT-8.1 should create a rule with every kind of condition, at the end of the list', async () => {
            await createRule({ name: 'First' });
            const response = await request(app)
                .post('/rules')
                .send(
                    coffeeRule({
                        name: 'Everything',
                        conditions: [
                            {
                                field: RuleConditionField.Merchant,
                                operator: RuleOperator.Equals,
                                text: ' Blue Bottle '
                            },
                            {
                                field: RuleConditionField.Amount,
                                operator: RuleOperator.GreaterThan,
                                direction: TransactionDirection.Out,
                                amount: 100
                            },
                            { field: RuleConditionField.Account, accountId },
                            { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: 'SQ' }
                        ]
                    })
                );

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject({
                name: 'Everything',
                position: 1,
                conditions: [
                    { field: RuleConditionField.Merchant, operator: RuleOperator.Equals, text: 'Blue Bottle' },
                    {
                        field: RuleConditionField.Amount,
                        operator: RuleOperator.GreaterThan,
                        direction: TransactionDirection.Out,
                        amount: 100
                    },
                    { field: RuleConditionField.Account, accountId },
                    { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: 'SQ' }
                ],
                actions: coffeeRule().actions
            });
        });

        it('CAT-8.1 should refuse a rule without conditions or actions, or with one field twice', async () => {
            const statement = coffeeRule().conditions[0] as RuleTextCondition;
            const bodies = [
                coffeeRule({ conditions: [] }),
                coffeeRule({ actions: [] }),
                coffeeRule({ conditions: [statement, { ...statement, text: 'other' }] }),
                coffeeRule({
                    actions: [
                        { type: RuleActionType.SetCategory, categoryId: coffeeId },
                        { type: RuleActionType.SetCategory, categoryId: diningId }
                    ]
                }),
                coffeeRule({ name: '' }),
                coffeeRule({ actions: [{ type: RuleActionType.RenameMerchant, merchant: '  ' }] }),
                coffeeRule({
                    conditions: [
                        {
                            field: RuleConditionField.Amount,
                            operator: RuleOperator.Equals,
                            direction: TransactionDirection.In,
                            amount: -5
                        }
                    ]
                }),
                coffeeRule({ conditions: [{ ...statement, operator: RuleOperator.GreaterThan } as never] })
            ];

            for (const body of bodies) {
                const response = await request(app).post('/rules').send(body);
                expect(response.status).toBe(400);
            }
        });

        it('CAT-8.1 should refuse a name another rule has, ignoring case', async () => {
            await createRule({ name: 'Coffee' });

            const response = await request(app)
                .post('/rules')
                .send(coffeeRule({ name: 'COFFEE' }));

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('A rule with that name already exists.');
        });

        it('CAT-8.1 should refuse an inactive category, and a missing category or account', async () => {
            const retired = await insertCategory('Retired', false);

            const inactive = await request(app)
                .post('/rules')
                .send(coffeeRule({ actions: [{ type: RuleActionType.SetCategory, categoryId: retired.id! }] }));
            const missingCategory = await request(app)
                .post('/rules')
                .send(coffeeRule({ actions: [{ type: RuleActionType.SetCategory, categoryId: 'CT-MISSING' }] }));
            const missingAccount = await request(app)
                .post('/rules')
                .send(coffeeRule({ conditions: [{ field: RuleConditionField.Account, accountId: 'AC-MISSING' }] }));

            expect(inactive.status).toBe(400);
            expect(inactive.body.message).toBe('Choose an active category.');
            expect(missingCategory.status).toBe(400);
            expect(missingCategory.body.message).toBe('Category not found.');
            expect(missingAccount.status).toBe(400);
            expect(missingAccount.body.message).toBe('Account not found.');
            expect((await request(app).get('/rules')).body).toEqual([]);
        });
    });

    describe('PUT /:id', () => {
        it('CAT-8.1 should replace the conditions and actions sent, keeping the rest', async () => {
            const id = await createRule();

            const response = await request(app)
                .put(`/rules/${id}`)
                .send({ actions: [{ type: RuleActionType.SetCategory, categoryId: diningId }] });

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                name: 'Blue Bottle',
                conditions: coffeeRule().conditions,
                actions: [{ type: RuleActionType.SetCategory, categoryId: diningId }]
            });
        });

        it('CAT-8.1 should rename a rule whose category was made inactive since, without its actions', async () => {
            const id = await createRule();
            await request(categoriesApp).put(`/categories/${coffeeId}`).send({ isActive: false });

            const renamed = await request(app).put(`/rules/${id}`).send({ name: 'Old coffee' });
            const resent = await request(app).put(`/rules/${id}`).send({ actions: coffeeRule().actions });

            expect(renamed.status).toBe(200);
            expect(resent.status).toBe(400);
        });

        it('should return 404 for a rule that does not exist', async () => {
            const response = await request(app).put('/rules/RL-MISSING').send({ name: 'Nope' });
            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /:id', () => {
        it('CAT-8.3 should delete a rule, leaving what it did to transactions', async () => {
            const id = await createRule();
            const transaction = await insertTransaction();
            await request(app).post(`/rules/${id}/apply`);

            const response = await request(app).delete(`/rules/${id}`);

            expect(response.status).toBe(204);
            expect((await request(app).get(`/rules/${id}`)).status).toBe(404);
            expect(await transactionData.retrieveSingle(transaction.id!)).toMatchObject({
                categoryId: coffeeId,
                categorySource: CategorySource.Rule,
                categoryRuleId: '',
                merchant: 'Blue Bottle',
                merchantRuleId: ''
            });
        });

        it('should return 404 for a rule that does not exist', async () => {
            expect((await request(app).delete('/rules/RL-MISSING')).status).toBe(404);
        });
    });

    describe('PUT /order', () => {
        it('CAT-8.3 should put the rules in the order given', async () => {
            const first = await createRule({ name: 'First' });
            const second = await createRule({ name: 'Second' });
            const third = await createRule({ name: 'Third' });

            const response = await request(app)
                .put('/rules/order')
                .send({ ids: [third, first, second] });

            expect(response.status).toBe(200);
            expect(response.body.map((r: { name: string }) => r.name)).toEqual(['Third', 'First', 'Second']);
            const list = await request(app).get('/rules');
            expect(list.body.map((r: { id: string }) => r.id)).toEqual([third, first, second]);
        });

        it("CAT-8.3 should refuse an order that isn't every rule's ID once", async () => {
            const first = await createRule({ name: 'First' });
            const second = await createRule({ name: 'Second' });

            for (const ids of [[first], [first, first], [first, second, 'RL-MISSING'], [first, 'RL-MISSING']]) {
                const response = await request(app).put('/rules/order').send({ ids });
                expect(response.status).toBe(400);
            }
        });
    });

    describe('GET /:id/matches and POST /:id/apply', () => {
        it('CAT-8.5 should count, then make, the changes to existing transactions', async () => {
            const id = await createRule();
            const uncategorized = await insertTransaction();
            const categorized = await insertTransaction({ categoryId: diningId });
            const alreadyRenamed = await insertTransaction({ merchant: 'Blue Bottle', categoryId: coffeeId });
            const other = await insertTransaction({ originalStatement: 'PAYROLL', merchant: 'Employer' });

            const matches = await request(app).get(`/rules/${id}/matches`);
            const applied = await request(app).post(`/rules/${id}/apply`);

            expect(matches.status).toBe(200);
            expect(matches.body).toEqual({ categorizeCount: 1, renameCount: 2 });
            expect(applied.status).toBe(200);
            expect(applied.body).toEqual({ categorizeCount: 1, renameCount: 2 });
            expect(await transactionData.retrieveSingle(uncategorized.id!)).toMatchObject({
                categoryId: coffeeId,
                categorySource: CategorySource.Rule,
                categoryRuleId: id,
                merchant: 'Blue Bottle',
                merchantRuleId: id
            });
            expect(await transactionData.retrieveSingle(categorized.id!)).toMatchObject({
                categoryId: diningId,
                categorySource: CategorySource.User,
                categoryRuleId: '',
                merchant: 'Blue Bottle',
                merchantRuleId: id
            });
            expect(await transactionData.retrieveSingle(alreadyRenamed.id!)).toMatchObject({ merchantRuleId: '' });
            expect(await transactionData.retrieveSingle(other.id!)).toMatchObject({
                categoryId: '',
                merchant: 'Employer'
            });
            expect((await request(app).get(`/rules/${id}/matches`)).body).toEqual({
                categorizeCount: 0,
                renameCount: 0
            });
        });

        it('CAT-8.7 should leave split transactions alone', async () => {
            const id = await createRule();
            const transaction = await insertTransaction();
            await transactionData.split(transaction.id!, [
                { id: transaction.id, amount: -2, categoryId: '', merchant: transaction.merchant, notes: '' },
                { amount: -2.5, categoryId: '', merchant: transaction.merchant, notes: '' }
            ]);

            const applied = await request(app).post(`/rules/${id}/apply`);

            expect(applied.body).toEqual({ categorizeCount: 0, renameCount: 0 });
        });

        it('should return 404 for a rule that does not exist', async () => {
            expect((await request(app).get('/rules/RL-MISSING/matches')).status).toBe(404);
            expect((await request(app).post('/rules/RL-MISSING/apply')).status).toBe(404);
        });
    });

    describe('deleting what a rule uses', () => {
        it('CAT-8.8 should refuse to delete a category a rule uses', async () => {
            await createRule();

            const response = await request(categoriesApp).delete(`/categories/${coffeeId}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('This category is used by a rule. Edit or delete the rule first.');
            expect(await categoryData.retrieveSingle(coffeeId)).not.toBeNull();
        });

        it('CAT-8.8 should refuse to delete an account a rule uses', async () => {
            await createRule({ conditions: [{ field: RuleConditionField.Account, accountId }] });

            const response = await request(accountsApp).delete(`/accounts/${accountId}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('This account is used by a rule. Edit or delete the rule first.');
            expect(await accountData.retrieveSingle(accountId)).not.toBeNull();
        });

        it('CAT-8.8 should delete them once the rule is gone', async () => {
            const id = await createRule({ conditions: [{ field: RuleConditionField.Account, accountId }] });
            await request(app).delete(`/rules/${id}`);

            expect((await request(categoriesApp).delete(`/categories/${coffeeId}`)).status).toBe(204);
            expect((await request(accountsApp).delete(`/accounts/${accountId}`)).status).toBe(204);
        });

        it("CAT-8.6 should leave a deleted category's transactions to the user's choice", async () => {
            const ruleId = await createRule({ actions: [{ type: RuleActionType.SetCategory, categoryId: diningId }] });
            const transaction = await insertTransaction();
            await request(app).post(`/rules/${ruleId}/apply`);
            await request(app).delete(`/rules/${ruleId}`);
            const toCoffee = await insertTransaction({ categoryId: diningId });

            const response = await request(categoriesApp).delete(`/categories/${diningId}?moveTo=${coffeeId}`);

            expect(response.status).toBe(204);
            for (const id of [transaction.id!, toCoffee.id!]) {
                expect(await transactionData.retrieveSingle(id)).toMatchObject({
                    categoryId: coffeeId,
                    categorySource: CategorySource.User,
                    categoryRuleId: ''
                });
            }
        });
    });
});
