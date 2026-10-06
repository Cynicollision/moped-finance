import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CategoryImportResult } from '@shared/finance/contracts';
import { CategoryType } from '@shared/finance/enum';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { ImportCategoriesComponent } from './import-categories.component';

describe('ImportCategoriesComponent', () => {
    const clean: CategoryImportResult = {
        isValidToImport: true,
        resultMessage: '',
        createdCount: 14,
        newGroups: [
            { name: 'Pets', type: CategoryType.Expense },
            { name: 'Side Income', type: CategoryType.Income }
        ],
        skippedNames: ['Coffee', 'Groceries', 'Rent'],
        failedRowMessages: []
    };

    async function render(dryRun: CategoryImportResult, realRun: CategoryImportResult = dryRun) {
        const financeService = {
            importCategories: vi.fn((_form: FormData, isDryRun: boolean) =>
                Promise.resolve(isDryRun ? dryRun : realRun)
            )
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ImportCategoriesComponent],
            providers: [
                provideRouter([]),
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(ImportCategoriesComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const click = async (label: string) => {
            Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
                .find(b => b.textContent!.trim() === label)!
                .click();
            await fixture.whenStable();
        };
        const validate = async () => {
            const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
            Object.defineProperty(input, 'files', { value: [new File(['Type'], 'categories.csv')] });
            input.dispatchEvent(new Event('change'));
            await fixture.whenStable();
            await click('Validate Import');
        };
        return { element, click, validate, financeService, notificationService, navigate };
    }

    const text = (element: Element | null) => element?.textContent!.replace(/\s+/g, ' ').trim();

    it('CAT-7.2 should sit below Settings and Categories, and list the columns the file needs', async () => {
        const { element } = await render(clean);

        expect(Array.from(element.querySelectorAll('app-page-header .crumbs a')).map(a => text(a))).toEqual([
            'Settings',
            'Categories'
        ]);
        expect(element.querySelector('app-csv-import strong')!.textContent).toBe(
            'Type, Group, Name, Icon, Necessity, IsActive'
        );
    });

    it('CAT-7.3 CAT-7.4 should preview the groups and categories to create and the names skipped', async () => {
        const { element, validate, financeService } = await render(clean);

        await validate();

        expect(financeService.importCategories).toHaveBeenCalledWith(expect.any(FormData), true);
        expect(Array.from(element.querySelectorAll('.dry-run-results > ul li')).map(li => li.textContent)).toEqual([
            'Groups to create: 2',
            'Categories to create: 14',
            'Already exist (skipped): 3',
            'Rows with errors: 0'
        ]);
        expect(text(element.querySelector('.new-groups'))).toBe('New groups: Pets (Expense), Side Income (Income)');
        expect(text(element.querySelector('.skipped'))).toBe('Skipped: Coffee, Groceries, Rent');
        expect(element.querySelector('.nothing-new')).toBeNull();
    });

    it('CAT-7.3 should list the first ten skipped names, and say when nothing is new', async () => {
        const names = Array.from({ length: 12 }, (_, i) => `Category ${i + 1}`);
        const { element, validate } = await render({ ...clean, createdCount: 0, newGroups: [], skippedNames: names });

        await validate();

        expect(element.querySelector('.new-groups')).toBeNull();
        expect(text(element.querySelector('.skipped'))).toBe(
            'Skipped: Category 1, Category 2, Category 3, Category 4, Category 5, Category 6, Category 7, Category 8, Category 9, Category 10 and 2 more'
        );
        expect(text(element.querySelector('.nothing-new'))).toBe(
            "Every category in the file already exists, so importing won't change anything."
        );
    });

    it('CAT-7.2 APP-2.3 should say what was created and return to Categories', async () => {
        const { click, validate, financeService, notificationService, navigate } = await render(clean);
        await validate();

        await click('Begin Import');

        expect(financeService.importCategories).toHaveBeenLastCalledWith(expect.any(FormData), false);
        expect(notificationService.success).toHaveBeenCalledWith('Successfully created 14 categories and 2 groups.');
        expect(navigate).toHaveBeenCalledWith(['/settings/categories']);
    });

    it('APP-2.3 should leave groups out of the message when none were created', async () => {
        const { click, validate, notificationService } = await render({ ...clean, createdCount: 1, newGroups: [] });
        await validate();

        await click('Begin Import');

        expect(notificationService.success).toHaveBeenCalledWith('Successfully created 1 category.');
    });
});
