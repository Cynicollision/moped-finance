import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Rule } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { RuleApplyOffer } from './rule-apply-offer.service';
import { RuleFormComponent } from './rule-form.component';

describe('RuleFormComponent', () => {
    const categories = [
        { id: 'coffee', name: 'Coffee', icon: '☕', isActive: true },
        { id: 'old', name: 'Old', icon: '', isActive: false }
    ] as Category[];
    const accounts = [
        { id: 'acc-1', name: 'Everyday Checking', isHidden: false },
        { id: 'acc-2', name: 'Old Card', isHidden: false, closedOn: '2026-01-01' }
    ] as Account[];
    const existing: Rule = {
        id: 'r1',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
        name: 'Old habit',
        position: 0,
        conditions: [{ field: RuleConditionField.Merchant, operator: RuleOperator.Contains, text: 'Habit' }],
        actions: [{ type: RuleActionType.SetCategory, categoryId: 'old' }]
    };

    async function render(options: { ruleId?: string; query?: Record<string, string> } = {}) {
        const financeService = {
            fetchRule: vi.fn().mockResolvedValue(existing),
            fetchAllAccounts: vi.fn().mockResolvedValue(accounts),
            fetchCategories: vi.fn().mockResolvedValue(categories),
            createRule: vi.fn().mockImplementation(r => Promise.resolve({ ...r, id: 'new' })),
            saveRule: vi.fn().mockResolvedValue(existing),
            deleteRule: vi.fn().mockResolvedValue(true)
        };
        const modalService = { confirm: vi.fn().mockResolvedValue(true) };
        const notificationService = { success: vi.fn() };
        const applyOffer = { offer: vi.fn().mockResolvedValue(false) };
        TestBed.configureTestingModule({
            imports: [RuleFormComponent],
            providers: [
                provideRouter([]),
                { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            paramMap: convertToParamMap(options.ruleId ? { ruleId: options.ruleId } : {}),
                            queryParamMap: convertToParamMap(options.query ?? {})
                        }
                    }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: NotificationService, useValue: notificationService },
                { provide: RuleApplyOffer, useValue: applyOffer }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(RuleFormComponent);
        await fixture.whenStable();
        const component = fixture.componentInstance;
        const element = fixture.nativeElement as HTMLElement;
        const labels = () => Array.from(element.querySelectorAll('.item-label')).map(l => l.textContent!.trim());
        const menuItems = async (label: string) => {
            Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
                .find(b => b.textContent!.includes(label))!
                .click();
            await fixture.whenStable();
            return Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item'));
        };
        return {
            fixture,
            component,
            element,
            labels,
            menuItems,
            financeService,
            modalService,
            notificationService,
            applyOffer,
            navigate
        };
    }

    it('CAT-8.1 should start a new rule with a Merchant condition and a Set category action', async () => {
        const { component, labels } = await render();

        expect(labels()).toEqual(['Merchant', 'Set category']);
        expect(component.form.controls.name.value).toBe('');
        expect(component.form.valid).toBe(false);
    });

    it('CAT-8.9 should fill a new rule in from a transaction: its merchant, or its statement without one', async () => {
        const fromMerchant = await render({ query: { merchant: 'Blue Bottle' } });
        expect(fromMerchant.component.form.controls.name.value).toBe('Blue Bottle');
        expect(fromMerchant.component.form.controls.conditions.getRawValue()[0]).toEqual(
            expect.objectContaining({
                field: RuleConditionField.Merchant,
                operator: RuleOperator.Equals,
                text: 'Blue Bottle'
            })
        );
        TestBed.resetTestingModule();

        const fromStatement = await render({ query: { statement: 'POS 1234 KIOSK' } });
        expect(fromStatement.labels()).toEqual(['Original Statement', 'Set category']);
        expect(fromStatement.component.form.controls.conditions.getRawValue()[0]).toEqual(
            expect.objectContaining({ operator: RuleOperator.Contains, text: 'POS 1234 KIOSK' })
        );
    });

    it('CAT-8.1 should offer each condition field and action once, and keep at least one of each', async () => {
        const { fixture, component, element, menuItems } = await render();

        const fields = (await menuItems('Add condition')).map(i => i.textContent!.trim());
        expect(fields).toEqual(['Original Statement', 'Amount', 'Account']);
        document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
        await fixture.whenStable();

        const removeMerchant = element.querySelector<HTMLButtonElement>('button[aria-label="Remove Merchant"]')!;
        expect(removeMerchant.disabled).toBe(true);
        component.addCondition(RuleConditionField.Account);
        await fixture.whenStable();
        expect(removeMerchant.disabled).toBe(false);

        component.addAction(RuleActionType.RenameMerchant);
        await fixture.whenStable();
        expect(Array.from(element.querySelectorAll('button')).some(b => b.textContent!.includes('Add action'))).toBe(
            false
        );
    });

    it('CAT-8.1 CAT-8.5 should create the rule entered, offer to apply it, and go back to Rules', async () => {
        const { fixture, component, financeService, notificationService, applyOffer, navigate } = await render();
        const form = component.form;
        form.controls.name.setValue(' Blue Bottle ');
        form.controls.conditions.at(0).controls.text.setValue('SQ *BLUE');
        component.addCondition(RuleConditionField.Amount);
        form.controls.conditions.at(1).patchValue({
            direction: TransactionDirection.Out,
            operator: RuleOperator.LessThan,
            amount: 20
        });
        form.controls.actions.at(0).controls.categoryId.setValue('coffee');
        await fixture.whenStable();

        await component.save();

        expect(financeService.createRule).toHaveBeenCalledWith({
            name: 'Blue Bottle',
            conditions: [
                { field: RuleConditionField.Merchant, operator: RuleOperator.Contains, text: 'SQ *BLUE' },
                {
                    field: RuleConditionField.Amount,
                    operator: RuleOperator.LessThan,
                    direction: TransactionDirection.Out,
                    amount: 20
                }
            ],
            actions: [{ type: RuleActionType.SetCategory, categoryId: 'coffee' }]
        });
        expect(notificationService.success).toHaveBeenCalledWith('Rule created');
        expect(applyOffer.offer).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }), false);
        expect(navigate).toHaveBeenCalledWith(['/settings/rules']);
        expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('CAT-8.1 should not save a category that is not chosen from the list', async () => {
        const { fixture, component, financeService } = await render();
        component.form.controls.name.setValue('Coffee');
        component.form.controls.conditions.at(0).controls.text.setValue('Coffee');
        component.form.controls.actions.at(0).controls.categoryId.setValue('Cofee');
        await fixture.whenStable();

        await component.save();

        expect(financeService.createRule).not.toHaveBeenCalled();
    });

    it('CAT-8.1 should mark an inactive category, and send actions on edit only when they changed', async () => {
        const { fixture, component, element, financeService } = await render({ ruleId: 'r1' });

        expect(element.querySelector('.inactive-hint')!.textContent).toContain('This category is inactive');
        component.form.controls.name.setValue('Older habit');
        component.form.markAsDirty();
        await component.save();
        expect(financeService.saveRule).toHaveBeenCalledWith('r1', {
            name: 'Older habit',
            conditions: existing.conditions
        });

        component.form.controls.actions.at(0).controls.categoryId.setValue('coffee');
        component.form.controls.actions.markAsDirty();
        await fixture.whenStable();
        await component.save();
        expect(financeService.saveRule).toHaveBeenLastCalledWith('r1', {
            name: 'Older habit',
            conditions: existing.conditions,
            actions: [{ type: RuleActionType.SetCategory, categoryId: 'coffee' }]
        });
    });

    it('CAT-8.1 should offer open accounts, and the closed one the rule already has', async () => {
        const { fixture, component } = await render();
        expect(component.accountOptions().map(a => a.name)).toEqual(['Everyday Checking']);

        component.addCondition(RuleConditionField.Account);
        await fixture.whenStable();
        expect(component.form.controls.conditions.at(1).controls.accountId.valid).toBe(false);
    });

    it('CAT-8.3 should delete the rule from its menu after confirming', async () => {
        const { component, financeService, modalService, navigate } = await render({ ruleId: 'r1' });

        await component.delete();

        expect(modalService.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete Rule' }));
        expect(financeService.deleteRule).toHaveBeenCalledWith('r1');
        expect(navigate).toHaveBeenCalledWith(['/settings/rules']);
    });
});
