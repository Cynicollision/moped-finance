import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Rule } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { RuleApplyOffer } from './rule-apply-offer.service';
import { RulesComponent } from './rules.component';

describe('RulesComponent', () => {
    function rule(id: string, name: string, changes: Partial<Rule> = {}): Rule {
        return {
            id,
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
            name,
            position: 0,
            conditions: [{ field: RuleConditionField.Merchant, operator: RuleOperator.Contains, text: name }],
            actions: [{ type: RuleActionType.SetCategory, categoryId: 'coffee' }],
            ...changes
        };
    }

    const blueBottle = rule('r1', 'Blue Bottle', {
        conditions: [
            { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: 'SQ *BLUE' },
            {
                field: RuleConditionField.Amount,
                operator: RuleOperator.LessThan,
                direction: TransactionDirection.Out,
                amount: 20
            }
        ],
        actions: [
            { type: RuleActionType.RenameMerchant, merchant: 'Blue Bottle' },
            { type: RuleActionType.SetCategory, categoryId: 'coffee' }
        ]
    });
    const retired = rule('r2', 'Old habit', { actions: [{ type: RuleActionType.SetCategory, categoryId: 'old' }] });
    const groceries = rule('r3', 'Groceries');
    const categories = [
        { id: 'coffee', name: 'Coffee', icon: '☕', isActive: true },
        { id: 'old', name: 'Old', icon: '', isActive: false }
    ] as Category[];

    async function render(rules: Rule[] = [blueBottle, retired, groceries]) {
        const financeService = {
            fetchRules: vi.fn().mockResolvedValue(rules),
            fetchAllAccounts: vi.fn().mockResolvedValue([] as Account[]),
            fetchCategories: vi.fn().mockResolvedValue(categories),
            reorderRules: vi
                .fn()
                .mockImplementation((ids: string[]) => Promise.resolve(ids.map(id => rules.find(r => r.id === id)!))),
            deleteRule: vi.fn().mockResolvedValue(true)
        };
        const modalService = { confirm: vi.fn().mockResolvedValue(true) };
        const notificationService = { success: vi.fn() };
        const applyOffer = { offer: vi.fn().mockResolvedValue(false) };
        TestBed.configureTestingModule({
            imports: [RulesComponent],
            providers: [
                provideRouter([]),
                { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: NotificationService, useValue: notificationService },
                { provide: RuleApplyOffer, useValue: applyOffer }
            ]
        });

        const fixture = TestBed.createComponent(RulesComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const names = () => Array.from(element.querySelectorAll('.rule-name')).map(n => n.textContent!.trim());
        const chooseFromMenu = async (ruleName: string, label: string) => {
            element.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${ruleName}"]`)!.click();
            await fixture.whenStable();
            Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'))
                .find(item => item.textContent!.includes(label))!
                .click();
            await fixture.whenStable();
        };
        return {
            fixture,
            element,
            names,
            chooseFromMenu,
            financeService,
            modalService,
            notificationService,
            applyOffer
        };
    }

    it('CAT-8.3 should list the rules in order, each with its conditions and actions', async () => {
        const { element, names } = await render();

        expect(names()).toEqual(['Blue Bottle', 'Old habit', 'Groceries']);
        const first = element.querySelector('.rule-row')!;
        const lines = Array.from(first.querySelectorAll('.rule-line')).map(l => l.textContent!.trim());
        expect(lines).toEqual([
            'Original Statement contains "SQ *BLUE"',
            'Money out, less than $20.00',
            'Rename merchant to Blue Bottle',
            'Set category to ☕ Coffee'
        ]);
        expect(first.querySelector('a.rule-name')!.getAttribute('href')).toBe('/settings/rules/r1');
    });

    it('CAT-8.1 should mark a Set category whose category is inactive', async () => {
        const { element } = await render();

        const rows = element.querySelectorAll('.rule-row');
        expect(rows[0].querySelector('.skipped-note')).toBeNull();
        expect(rows[1].querySelector('.skipped-note')!.textContent).toContain('Inactive category, skipped');
    });

    it('CAT-8.3 should say when there are no rules yet', async () => {
        const { element } = await render([]);

        expect(element.querySelector('.empty-state')!.textContent).toContain('No rules yet.');
        expect(element.querySelector('app-list')).toBeNull();
    });

    it('CAT-8.3 should save the new order when a rule is dragged', async () => {
        const { fixture, names, financeService } = await render();

        fixture.componentInstance.drop({ previousIndex: 2, currentIndex: 0 } as CdkDragDrop<Rule[]>);
        await fixture.whenStable();

        expect(financeService.reorderRules).toHaveBeenCalledWith(['r3', 'r1', 'r2']);
        expect(names()).toEqual(['Groceries', 'Blue Bottle', 'Old habit']);
    });

    it('CAT-8.3 should move a rule down from its menu, and put it back if the server refuses', async () => {
        const { names, chooseFromMenu, financeService } = await render();

        await chooseFromMenu('Blue Bottle', 'Move down');
        expect(financeService.reorderRules).toHaveBeenCalledWith(['r2', 'r1', 'r3']);
        expect(names()).toEqual(['Old habit', 'Blue Bottle', 'Groceries']);

        financeService.reorderRules.mockResolvedValue(undefined);
        await chooseFromMenu('Blue Bottle', 'Move up');
        expect(names()).toEqual(['Old habit', 'Blue Bottle', 'Groceries']);
    });

    it('CAT-8.3 should delete a rule after confirming', async () => {
        const { chooseFromMenu, financeService, modalService, notificationService } = await render();

        await chooseFromMenu('Groceries', 'Delete');

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Delete Rule', message: expect.stringContaining('Delete Groceries?') })
        );
        expect(financeService.deleteRule).toHaveBeenCalledWith('r3');
        expect(notificationService.success).toHaveBeenCalledWith('Rule deleted');
        expect(financeService.fetchRules).toHaveBeenCalledTimes(2);
    });

    it('CAT-8.5 should offer to apply a rule to existing transactions from its menu', async () => {
        const { chooseFromMenu, applyOffer } = await render();

        await chooseFromMenu('Groceries', 'Apply to existing');

        expect(applyOffer.offer).toHaveBeenCalledWith(groceries, true);
    });
});
