import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { FinanceInstitutionsComponent } from './institutions.component';

describe('FinanceInstitutionsComponent', () => {
    async function render() {
        TestBed.configureTestingModule({
            imports: [FinanceInstitutionsComponent],
            providers: [
                provideRouter([]),
                {
                    provide: FinanceService,
                    useValue: {
                        fetchInstitutions: vi.fn().mockResolvedValue([]),
                        fetchAllAccounts: vi.fn().mockResolvedValue([])
                    }
                },
                { provide: ModalService, useValue: { open: vi.fn() } }
            ]
        });
        const fixture = TestBed.createComponent(FinanceInstitutionsComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    it('INST-1.10 should offer Add Institution and Add Account in the header menu, with no header button', async () => {
        const { fixture, element } = await render();

        expect(element.querySelector('app-page-header .page-action')).toBeNull();

        element.querySelector<HTMLButtonElement>('app-page-header [aria-label="More options"]')!.click();
        await fixture.whenStable();

        const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item'));
        expect(items.map(item => item.textContent!.trim())).toEqual([
            'account_balanceAdd Institution',
            'addAdd Account'
        ]);
        expect(items[1].getAttribute('href')).toBe('/accounts/new');
    });
});
