import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** The theme's colours for charts, as `rgb()` values. */
export interface ChartColors {
    /** Axis labels. */
    text: string;
    /** Grid lines and the axis line. */
    grid: string;
    /** Tooltip background and text (Material 3's plain tooltip: the inverse surface). */
    tooltip: string;
    tooltipText: string;
    positive: string;
    negative: string;
}

/**
 * Reads the theme tokens in `styles.scss` for Chart.js, which draws on a canvas and can't use CSS variables.
 * A change of theme (SET-3.1) changes `changes`, which `colors()` reads, so a `computed()` or effect that
 * reads colours runs again and its chart redraws in the new colours.
 */
@Injectable({
    providedIn: 'root'
})
export class ChartThemeService {
    private readonly document = inject(DOCUMENT);
    private readonly changeCount = signal(0);

    /** Counts changes of the colours showing: the theme, or the device's light or dark setting under Match system. */
    readonly changes = this.changeCount.asReadonly();

    constructor() {
        const changed = () => this.changeCount.update(count => count + 1);
        // Watch the page rather than ThemeService, so charts don't depend on how the theme is chosen.
        new MutationObserver(changed).observe(this.document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
        this.document.defaultView?.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', changed);
    }

    colors(): ChartColors {
        this.changeCount();

        // A token can be another variable or a Material expression, so let the browser resolve it as a colour.
        const probe = this.document.createElement('span');
        this.document.body.appendChild(probe);
        const read = (token: string) => {
            probe.style.color = `var(${token})`;
            return this.document.defaultView!.getComputedStyle(probe).color;
        };

        try {
            return {
                text: read('--text-muted'),
                grid: read('--border-color'),
                tooltip: read('--mat-sys-inverse-surface'),
                tooltipText: read('--mat-sys-inverse-on-surface'),
                positive: read('--color-positive'),
                negative: read('--color-negative')
            };
        } finally {
            probe.remove();
        }
    }

    /** The theme's body font family. */
    fontFamily(): string {
        const style = this.document.defaultView!.getComputedStyle(this.document.documentElement);
        return style.getPropertyValue('--mat-sys-body-medium-font').trim() || 'Roboto, sans-serif';
    }

    /** An `rgb()` colour made translucent (a fill under a line); any other value is returned as it is. */
    static withAlpha(color: string, alpha: number): string {
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
        return match ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})` : color;
    }
}
