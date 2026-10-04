import { ChangeDetectionStrategy, Component, WritableSignal, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LayoutService, SizeClass } from './../layout/layout.service';
import { HasUnsavedChanges } from './../unsaved-changes';
import { ModalOptions, ModalService } from './modal.service';

@Component({
    selector: 'app-stub-form-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: '<input>'
})
class StubFormDialogComponent implements HasUnsavedChanges {
    static dirty = false;

    hasUnsavedChanges(): boolean {
        return StubFormDialogComponent.dirty;
    }
}

describe('ModalService', () => {
    function setup(sizeClass: SizeClass = 'expanded') {
        const size = signal(sizeClass);
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: LayoutService,
                    useValue: { sizeClass: size, isCompact: computed(() => size() === 'compact') }
                }
            ]
        });
        return TestBed.inject(ModalService);
    }

    async function open(service: ModalService, options?: ModalOptions) {
        let closed = false;
        const result = service.open(StubFormDialogComponent, undefined, options).then(() => {
            closed = true;
        });
        await settle();
        return { result, isClosed: () => closed };
    }

    function pressEscape() {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }

    async function settle() {
        await new Promise(resolve => setTimeout(resolve));
    }

    beforeEach(() => {
        StubFormDialogComponent.dirty = false;
    });

    afterEach(() => {
        document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
    });

    it('APP-2.7 should close a dialog without changes on Esc and on a click outside', async () => {
        const service = setup();

        const first = await open(service);
        pressEscape();
        await first.result;
        expect(first.isClosed()).toBe(true);

        const second = await open(service);
        document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
        await second.result;
        expect(second.isClosed()).toBe(true);
    });

    it('APP-2.7 should ask before discarding unsaved changes, and stay open to keep editing', async () => {
        const service = setup();
        const confirmDiscard = vi.spyOn(service, 'confirmDiscard').mockResolvedValue(false);
        StubFormDialogComponent.dirty = true;

        const dialog = await open(service);
        pressEscape();
        await settle();

        expect(confirmDiscard).toHaveBeenCalledTimes(1);
        expect(dialog.isClosed()).toBe(false);

        confirmDiscard.mockResolvedValue(true);
        pressEscape();
        await dialog.result;
        expect(dialog.isClosed()).toBe(true);
    });

    it('APP-2.6 should fill the screen on phones, but not for a confirmation', async () => {
        const service = setup('compact');

        const dialog = await open(service);
        expect(document.querySelector('.full-screen-dialog')).not.toBeNull();
        pressEscape();
        await dialog.result;

        service.confirm({ message: 'Continue?' });
        await settle();
        expect(document.querySelector('.full-screen-dialog')).toBeNull();
        expect(document.querySelector('app-confirm-modal')).not.toBeNull();
    });

    it('APP-2.6 should show a dialog, not a full screen, on larger windows', async () => {
        const service = setup('medium');

        await open(service);

        expect(document.querySelector('app-stub-form-dialog')).not.toBeNull();
        expect(document.querySelector('.full-screen-dialog')).toBeNull();
    });

    it('APP-2.6 should show a side panel on larger windows, and fill the screen on phones', async () => {
        const service = setup('expanded');

        const panel = await open(service, { size: 'panel' });
        expect(document.querySelector('.side-panel-dialog app-stub-form-dialog')).not.toBeNull();
        pressEscape();
        await panel.result;

        (TestBed.inject(LayoutService).sizeClass as WritableSignal<SizeClass>).set('compact');
        await open(service, { size: 'panel' });
        expect(document.querySelector('.full-screen-dialog app-stub-form-dialog')).not.toBeNull();
        expect(document.querySelector('.side-panel-dialog')).toBeNull();
    });
});
