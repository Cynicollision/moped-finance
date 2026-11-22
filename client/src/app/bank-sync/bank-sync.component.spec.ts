import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BankSyncWording } from '@shared/finance/contracts';
import {
    BankAccountAction,
    BankAccountLinkStatus,
    BankSyncPauseReason,
    SyncRunStatus,
    SyncTrigger
} from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { BankAccountSetupDialogComponent } from './bank-account-setup-dialog.component';
import { BankSyncComponent, disconnectMessage } from './bank-sync.component';
import { BankSyncService } from './bank-sync.service';

describe('BankSyncComponent', () => {
    const run: SyncRun = {
        id: 'run-1',
        trigger: SyncTrigger.Connect,
        status: SyncRunStatus.Succeeded,
        startedAt: new Date(2026, 10, 21, 9, 0),
        finishedAt: new Date(2026, 10, 21, 9, 0, 2),
        accountsUpdated: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        failure: null,
        messages: []
    };

    function status(changes: Partial<BankSyncStatus> = {}): BankSyncStatus {
        return {
            keyConfigured: true,
            connected: true,
            connectedAt: new Date(2026, 10, 21, 9, 0),
            host: 'bridge.example.org',
            pausedReason: null,
            isRunning: false,
            lastRun: run,
            quota: { limit: 20, remaining: 19, availableAt: null },
            ...changes
        };
    }

    function bankAccount(changes: Partial<BankAccount>): BankAccount {
        return {
            id: 'ba',
            connectionId: 'conn-harbor',
            connectionName: 'Harbor Community Bank',
            name: 'Everyday Checking',
            currency: 'USD',
            canLink: true,
            balance: 1234.5,
            availableBalance: null,
            balanceDate: new Date(2026, 10, 21),
            linkStatus: BankAccountLinkStatus.NotSetUp,
            linkedAccount: null,
            missingSince: null,
            lastSyncedAt: null,
            syncFrom: null,
            ...changes
        };
    }

    const accounts: BankAccount[] = [
        bankAccount({
            id: 'ba-checking',
            name: 'Everyday Checking',
            linkStatus: BankAccountLinkStatus.Linked,
            linkedAccount: { id: 'acc-1', name: 'Checking' }
        }),
        bankAccount({ id: 'ba-holiday', name: 'Holiday Fund' }),
        bankAccount({
            id: 'ba-savings',
            name: 'High-Yield Savings',
            linkStatus: BankAccountLinkStatus.Ignored,
            missingSince: new Date(2026, 10, 20)
        }),
        bankAccount({
            id: 'ba-chequing',
            connectionId: 'conn-maple',
            connectionName: 'Maple Leaf Trust',
            name: 'Chequing',
            currency: 'CAD',
            canLink: false
        })
    ];

    async function render(options: { status?: BankSyncStatus; accounts?: BankAccount[]; runs?: SyncRun[] } = {}) {
        const bankSyncService = {
            fetchStatus: vi.fn().mockResolvedValue(options.status ?? status()),
            fetchAccounts: vi.fn().mockResolvedValue(options.accounts ?? accounts),
            fetchRuns: vi.fn().mockResolvedValue(options.runs ?? [run]),
            connect: vi.fn().mockResolvedValue(status()),
            sync: vi.fn().mockResolvedValue({ ...run, id: 'run-2', trigger: SyncTrigger.Manual, transactionsAdded: 3 }),
            disconnect: vi.fn().mockResolvedValue(true),
            updateBankAccount: vi.fn().mockResolvedValue({ bankAccount: accounts[0], transactionsAdded: 0 })
        };
        const notificationService = { success: vi.fn(), error: vi.fn() };
        const modalService = { confirm: vi.fn().mockResolvedValue(true), open: vi.fn().mockResolvedValue(true) };
        TestBed.configureTestingModule({
            imports: [BankSyncComponent],
            providers: [
                provideRouter([]),
                { provide: BankSyncService, useValue: bankSyncService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: modalService }
            ]
        });

        const fixture = TestBed.createComponent(BankSyncComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        return { fixture, element, bankSyncService, notificationService, modalService };
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
        return [...element.querySelectorAll<HTMLButtonElement>('button')].find(
            b => b.textContent?.trim() === label || b.getAttribute('aria-label') === label
        );
    }

    function rowNames(element: HTMLElement): string[] {
        return [...element.querySelectorAll('.account-name')].map(e => e.textContent!.trim());
    }

    it('SYNC-1.2 should say only that a key is needed when the server has none', async () => {
        const { element, bankSyncService } = await render({
            status: status({ keyConfigured: false, connected: false })
        });

        expect(element.textContent).toContain(BankSyncWording.noKey);
        expect(element.querySelector('app-setup-token-form')).toBeNull();
        expect(button(element, 'Sync now')).toBeUndefined();
        expect(bankSyncService.fetchAccounts).not.toHaveBeenCalled();
    });

    it('SYNC-1.1 should offer a setup token field while not connected', async () => {
        const { element, bankSyncService } = await render({
            status: status({ connected: false, connectedAt: null, lastRun: null })
        });

        expect(element.querySelector('app-setup-token-form input')).not.toBeNull();
        expect(button(element, 'Sync now')).toBeUndefined();
        expect(bankSyncService.fetchAccounts).not.toHaveBeenCalled();
    });

    it('SYNC-1.1 should claim the trimmed setup token and show the connection', async () => {
        const { fixture, element, bankSyncService, notificationService } = await render({
            status: status({ connected: false, connectedAt: null, lastRun: null })
        });
        bankSyncService.fetchStatus.mockResolvedValue(status());

        const input = element.querySelector<HTMLInputElement>('app-setup-token-form input')!;
        input.value = '  fake  ';
        input.dispatchEvent(new Event('input'));
        element.querySelector('app-setup-token-form form')!.dispatchEvent(new Event('submit'));
        await fixture.whenStable();

        expect(bankSyncService.connect).toHaveBeenCalledWith('fake');
        expect(notificationService.success).toHaveBeenCalledWith('Bank sync connected');
        expect(rowNames(element)).toContain('Everyday Checking');
    });

    it('SYNC-2.1 SYNC-2.2 should list bank accounts under their connections with Not set up first and highlighted', async () => {
        const { element } = await render();

        const headings = [...element.querySelectorAll('[appListSubheader] h3')].map(e => e.textContent!.trim());
        expect(headings).toEqual(['Harbor Community Bank', 'Maple Leaf Trust']);
        expect(rowNames(element)).toEqual(['Holiday Fund', 'Everyday Checking', 'High-Yield Savings', 'Chequing']);
        const highlighted = [...element.querySelectorAll('.not-set-up .account-name')].map(e => e.textContent!.trim());
        expect(highlighted).toEqual(['Holiday Fund']);
        expect(element.textContent).toContain('Checking');
        expect(element.textContent).toContain("Don't sync");
    });

    it('SYNC-2.6 should show non-US-dollar bank accounts as unlinkable', async () => {
        const { element } = await render();

        const row = [...element.querySelectorAll('[appListRow]')].find(r => r.textContent!.includes('Chequing'))!;
        expect(row.textContent).toContain(BankSyncWording.notUsd);
        expect(row.textContent).toContain('CAD');
        expect(row.classList).not.toContain('not-set-up');
    });

    it('SYNC-2.9 should show when a bank account went missing', async () => {
        const { element } = await render();

        expect(element.textContent).toContain('Missing from SimpleFIN since Nov 20, 2026');
    });

    it('SYNC-3.3 should sync now and say what the sync added', async () => {
        const { fixture, element, bankSyncService, notificationService } = await render();

        button(element, 'Sync now')!.click();
        await fixture.whenStable();

        expect(bankSyncService.sync).toHaveBeenCalled();
        expect(notificationService.success).toHaveBeenCalledWith('Sync finished: 3 transactions added');
        expect(bankSyncService.fetchStatus).toHaveBeenCalledTimes(2);
    });

    it("SYNC-3.3 should report a sync that failed with the run's reason", async () => {
        const { fixture, element, bankSyncService, notificationService } = await render();
        bankSyncService.sync.mockResolvedValue({
            ...run,
            status: SyncRunStatus.Failed,
            failure: "The SimpleFIN server didn't answer in time."
        });

        button(element, 'Sync now')!.click();
        await fixture.whenStable();

        expect(notificationService.error).toHaveBeenCalledWith("The SimpleFIN server didn't answer in time.");
    });

    it('SYNC-3.3 should disable Sync now while a sync is running', async () => {
        const { element } = await render({ status: status({ isRunning: true }) });

        expect(button(element, 'Sync now')!.disabled).toBe(true);
        expect(element.textContent).toContain('A sync is running.');
    });

    it('SYNC-3.3 should disable Sync now at the limit and say when it is available again', async () => {
        const availableAt = new Date(2026, 10, 22, 9, 17);
        const { element } = await render({ status: status({ quota: { limit: 20, remaining: 0, availableAt } }) });

        expect(button(element, 'Sync now')!.disabled).toBe(true);
        expect(element.textContent).toContain('Available again Nov 22, 9:17 AM');
    });

    it('SYNC-1.3 should say why syncing is paused and offer Connect again', async () => {
        const { fixture, element } = await render({ status: status({ pausedReason: BankSyncPauseReason.Refused }) });

        expect(element.textContent).toContain(BankSyncWording.paused.refused);
        expect(button(element, 'Sync now')!.disabled).toBe(true);
        expect(button(element, 'Try again')).toBeUndefined();

        button(element, 'Connect again')!.click();
        await fixture.whenStable();
        expect(element.querySelector('.paused app-setup-token-form input')).not.toBeNull();
    });

    it('SYNC-1.3 should offer Try again when the subscription needs payment, which syncs', async () => {
        const { fixture, element, bankSyncService } = await render({
            status: status({ pausedReason: BankSyncPauseReason.Payment })
        });

        expect(element.textContent).toContain(BankSyncWording.paused.payment);
        expect(button(element, 'Connect again')).toBeDefined();

        button(element, 'Try again')!.click();
        await fixture.whenStable();
        expect(bankSyncService.sync).toHaveBeenCalled();
    });

    it("SYNC-5.2 should show the SimpleFIN server's messages from the last sync as plain text, as SimpleFIN's", async () => {
        const lastRun: SyncRun = {
            ...run,
            messages: [{ code: 'con.auth', text: '<b>Sign in</b> again', connectionId: 'c', accountId: null }]
        };
        const { element } = await render({ status: status({ lastRun }) });

        const message = element.querySelector('.server-messages li')!;
        expect(message.textContent).toContain('SimpleFIN: <b>Sign in</b> again');
        expect(element.textContent).not.toContain('Bridge');
        expect(message.querySelector('b')).toBeNull();
    });

    it('SYNC-3.7 should list the recent syncs with how each started and its result', async () => {
        const failed: SyncRun = {
            ...run,
            id: 'run-0',
            trigger: SyncTrigger.Scheduled,
            status: SyncRunStatus.Failed,
            failure: 'The SimpleFIN server refused the access URL (403).'
        };
        const { element } = await render({ runs: [run, failed] });

        const rows = [...element.querySelectorAll('[appListCell="trigger"]')].map(e => e.textContent!.trim());
        expect(rows).toEqual(['Connecting', 'Scheduled']);
        expect(element.textContent).toContain('The SimpleFIN server refused the access URL (403).');
    });

    it('SYNC-1.1 should link the connect text to simplefin.org and never name Bridge', async () => {
        const { element } = await render({ status: status({ connected: false, connectedAt: null, lastRun: null }) });

        expect(element.querySelector('h2')!.textContent).toContain('Connect to SimpleFIN');
        expect(element.querySelector<HTMLAnchorElement>('a[href*="simplefin.org"]')!.href).toBe(
            'https://www.simplefin.org/'
        );
        expect(element.textContent).not.toContain('Bridge');
    });

    it('SYNC-3.7 should give the last sync its result beside the label, and where it is connected at the end', async () => {
        const { element } = await render();

        const label = element.querySelector('.status-figures dt')!;
        expect(label.textContent).toContain('Last sync');
        expect(label.querySelector('.run-status')!.textContent).toBe('Succeeded');
        expect(element.querySelector('.status-figures')!.textContent).not.toContain('Connected');
        expect(element.querySelector('.connected-line')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
            'Connected to bridge.example.org since Nov 21, 2026'
        );
    });

    it('SYNC-2.1 should offer Set up only on Not set up rows and a menu on every US dollar row', async () => {
        const { element } = await render();

        const setUp = [...element.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Set up');
        expect(setUp.map(b => b.getAttribute('aria-label'))).toEqual(['Set up Holiday Fund']);
        const menus = [...element.querySelectorAll('button[aria-label^="Actions for"]')].map(b =>
            b.getAttribute('aria-label')
        );
        expect(menus).toEqual([
            'Actions for Holiday Fund',
            'Actions for Everyday Checking',
            'Actions for High-Yield Savings'
        ]);
    });

    it('SYNC-2.1 should open the set-up dialog, with the choice made when it comes from the menu', async () => {
        const { fixture, element, modalService, bankSyncService } = await render();

        button(element, 'Set up Holiday Fund')!.click();
        await fixture.whenStable();
        expect(modalService.open).toHaveBeenCalledWith(BankAccountSetupDialogComponent, {
            bankAccount: accounts[1],
            choice: undefined
        });
        expect(bankSyncService.fetchStatus).toHaveBeenCalledTimes(2);

        await fixture.componentInstance.setUp(accounts[2], BankAccountAction.Create);
        expect(modalService.open).toHaveBeenLastCalledWith(BankAccountSetupDialogComponent, {
            bankAccount: accounts[2],
            choice: BankAccountAction.Create
        });
    });

    it("SYNC-2.2 should mark a bank account Don't sync without asking", async () => {
        const { fixture, bankSyncService, modalService, notificationService } = await render();

        await fixture.componentInstance.dontSync(accounts[1]);

        expect(modalService.confirm).not.toHaveBeenCalled();
        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-holiday', {
            action: BankAccountAction.Ignore
        });
        expect(notificationService.success).toHaveBeenCalledWith("Bank account set to Don't sync");
    });

    it("SYNC-2.2 SYNC-2.7 should ask as Unlink does before Don't sync on a linked bank account", async () => {
        const { fixture, bankSyncService, modalService } = await render();
        modalService.confirm.mockResolvedValue(false);

        await fixture.componentInstance.dontSync(accounts[0]);

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Unlink Checking? It becomes manual and keeps its balance history and transactions.'
            })
        );
        expect(bankSyncService.updateBankAccount).not.toHaveBeenCalled();
    });

    it('SYNC-2.7 should unlink after confirming', async () => {
        const { fixture, bankSyncService, modalService, notificationService } = await render();

        await fixture.componentInstance.unlink(accounts[0]);

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Unlink Account',
                message: 'Unlink Checking? It becomes manual and keeps its balance history and transactions.',
                confirmLabel: 'Unlink'
            })
        );
        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-checking', {
            action: BankAccountAction.Unlink
        });
        expect(notificationService.success).toHaveBeenCalledWith('Account unlinked');
    });

    it('SYNC-1.4 should disconnect after confirming', async () => {
        const { fixture, bankSyncService, modalService, notificationService } = await render();

        await fixture.componentInstance.disconnect();

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({ message: disconnectMessage(1), confirmLabel: 'Disconnect' })
        );
        expect(bankSyncService.disconnect).toHaveBeenCalled();
        expect(notificationService.success).toHaveBeenCalledWith('Bank sync disconnected');
    });

    it('SYNC-1.4 should name how many synced accounts become manual', () => {
        expect(disconnectMessage(2)).toBe(
            'Disconnect bank sync? Your 2 synced accounts become manual and keep their history.'
        );
        expect(disconnectMessage(1)).toBe(
            'Disconnect bank sync? Your 1 synced account becomes manual and keeps its history.'
        );
        expect(disconnectMessage(0)).toBe('Disconnect bank sync? No accounts are synced yet, so nothing else changes.');
    });
});
