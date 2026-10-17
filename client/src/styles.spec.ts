import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { compile } from 'sass';

@Component({
    imports: [MatButtonModule, MatIconModule, MatMenuModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button type="button" class="trigger" [matMenuTriggerFor]="menu">Open</button>
        <mat-menu #menu="matMenu">
            <button mat-menu-item class="plain-item"><mat-icon>edit</mat-icon><span>Edit</span></button>
            <button mat-menu-item class="danger-item"><mat-icon>delete</mat-icon><span>Delete</span></button>
        </mat-menu>
        <button mat-button class="danger-button">Delete</button>
        <button mat-flat-button class="danger-button">Delete</button>
    `
})
class DangerControlsComponent {}

// The unit tests don't load the global stylesheet, so compile it and add it ahead of the component styles Angular
// adds, in the order the app has them: Material's own styles come later and win a tie in specificity. jsdom applies
// the cascade but doesn't resolve var(), so the tests check that Material's colour tokens reach the elements.
describe('Global styles', () => {
    let globalStyles: HTMLStyleElement;

    beforeAll(() => {
        globalStyles = document.createElement('style');
        globalStyles.textContent = compile('src/styles.scss', { loadPaths: ['node_modules', 'src/styles'] }).css;
        document.head.prepend(globalStyles);
    });

    afterAll(() => globalStyles.remove());

    afterEach(() => {
        document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
    });

    async function render() {
        const fixture = TestBed.createComponent(DangerControlsComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        element.querySelector<HTMLButtonElement>('.trigger')!.click();
        await fixture.whenStable();
        return element;
    }

    function token(element: Element, name: string): string {
        return getComputedStyle(element).getPropertyValue(name).trim();
    }

    it('APP-1.10 APP-2.4 should show a danger menu entry and its icon in the error colour', async () => {
        await render();
        const dangerItem = document.querySelector('.danger-item')!;
        const plainItem = document.querySelector('.plain-item')!;

        expect(token(dangerItem, '--mat-menu-item-label-text-color')).toBe('var(--color-negative)');
        expect(token(dangerItem.querySelector('mat-icon')!, '--mat-menu-item-icon-color')).toBe(
            'var(--color-negative)'
        );
        expect(token(plainItem, '--mat-menu-item-label-text-color')).toBe('');
    });

    it('APP-2.4 should show danger buttons in the error colour', async () => {
        const element = await render();
        const [textButton, filledButton] = Array.from(element.querySelectorAll('.danger-button'));

        expect(token(textButton, '--mat-button-text-label-text-color')).toBe('var(--mat-sys-error)');
        expect(token(filledButton, '--mat-button-filled-container-color')).toBe('var(--mat-sys-error)');
    });
});
