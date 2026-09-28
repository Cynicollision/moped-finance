import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Minimum widths, in px, of the Material 3 window size classes above compact.
 * Keep in sync with src/styles/_breakpoints.scss.
 */
export const Breakpoint = {
    Medium: 600,
    Expanded: 840,
    Large: 1200
} as const;

export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large';

const sizeOrder: SizeClass[] = ['compact', 'medium', 'expanded', 'large'];

const minWidth = (px: number) => `(min-width: ${px}px)`;

/**
 * The viewport's size class, as a signal. Use it for decisions that need TypeScript (the navigation
 * mode, dialog sizing); lay out content with the SCSS mixins in `_breakpoints.scss` instead.
 */
@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    private readonly matches = toSignal(
        inject(BreakpointObserver)
            .observe([minWidth(Breakpoint.Medium), minWidth(Breakpoint.Expanded), minWidth(Breakpoint.Large)])
            .pipe(map(state => state.breakpoints)),
        { requireSync: true }
    );

    readonly sizeClass = computed<SizeClass>(() => {
        const matches = this.matches();
        if (matches[minWidth(Breakpoint.Large)]) {
            return 'large';
        }
        if (matches[minWidth(Breakpoint.Expanded)]) {
            return 'expanded';
        }
        if (matches[minWidth(Breakpoint.Medium)]) {
            return 'medium';
        }
        return 'compact';
    });

    readonly isCompact = computed(() => this.sizeClass() === 'compact');

    /** Whether the shell is showing the bottom navigation bar, set by the shell. Snackbars sit above it. */
    readonly hasBottomNav = signal(false);

    /** Whether the viewport is `size` or wider. Reads the signal, so it's reactive in templates and computeds. */
    atLeast(size: SizeClass): boolean {
        return sizeOrder.indexOf(this.sizeClass()) >= sizeOrder.indexOf(size);
    }
}
