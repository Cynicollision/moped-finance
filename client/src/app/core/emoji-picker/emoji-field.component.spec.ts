import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { LayoutService } from './../layout/layout.service';
import { EmojiFieldComponent } from './emoji-field.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, EmojiFieldComponent],
    template: `<app-emoji-field [formControl]="icon" label="Icon" />`
})
class HostComponent {
    readonly icon = new FormControl('', { nonNullable: true });
}

// A stand-in for <emoji-picker>, which needs IndexedDB (jsdom has none). emoji-picker-element leaves an element
// that's already defined alone, so the field's tests check its own wiring: what it does with an emoji-click.
if (!customElements.get('emoji-picker')) {
    customElements.define('emoji-picker', class extends HTMLElement {});
}

describe('EmojiFieldComponent', () => {
    async function render(icon = '', compact = false) {
        TestBed.configureTestingModule({
            imports: [HostComponent],
            providers: [
                { provide: LayoutService, useValue: { isCompact: signal(compact) } },
                { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }
            ]
        });
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.icon.setValue(icon);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        return { fixture, element, control: fixture.componentInstance.icon };
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement | null {
        return element.querySelector(`button[aria-label="${label}"]`);
    }

    /** The open picker, once the field has loaded emoji-picker-element and shown it. */
    async function openPicker(): Promise<Element> {
        return vi.waitFor(() => document.querySelector('emoji-picker') ?? Promise.reject(new Error('Not open')));
    }

    async function waitForClose() {
        await vi.waitFor(() => expect(document.querySelector('emoji-picker')).toBeNull());
    }

    function pick(picker: Element, emoji: string) {
        picker.dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode: emoji } }));
    }

    it('CAT-1.20 should show the chosen emoji, and remove it', async () => {
        const { fixture, element, control } = await render('🛒');
        const input = element.querySelector('input')!;

        expect(input.value).toBe('🛒');

        button(element, 'Remove Icon')!.click();
        await fixture.whenStable();

        expect(control.value).toBe('');
        expect(control.dirty).toBe(true);
        expect(input.value).toBe('');
        expect(button(element, 'Remove Icon')).toBeNull();
    });

    it('CAT-1.20 should set the emoji picked in the popover, and close it', async () => {
        const { fixture, element, control } = await render();

        button(element, 'Choose an emoji')!.click();
        pick(await openPicker(), '🧑‍🍳');
        await fixture.whenStable();

        expect(control.value).toBe('🧑‍🍳');
        expect(element.querySelector('input')!.value).toBe('🧑‍🍳');
        await waitForClose();
    });

    it('CAT-1.20 should open the picker in a bottom sheet on phones', async () => {
        const { element, control } = await render('', true);

        button(element, 'Choose an emoji')!.click();
        const picker = await openPicker();

        expect(picker.closest('mat-bottom-sheet-container')).not.toBeNull();

        pick(picker, '⛽');

        expect(control.value).toBe('⛽');
        await waitForClose();
    });

    it('CAT-1.20 should open the picker from the keyboard without submitting the form', async () => {
        const { element } = await render();

        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        element.querySelector('input')!.dispatchEvent(enter);

        expect(await openPicker()).not.toBeNull();
        expect(enter.defaultPrevented).toBe(true);
    });
});
