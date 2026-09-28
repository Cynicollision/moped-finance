import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { ChartThemeService } from './chart-theme.service';

export type { ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

/**
 * A Chart.js chart that fills its host and resizes with it. Set the host's size (the `height` input or
 * CSS). A new `config` updates the chart in place, animating to the new data, unless the chart type changes.
 * Colours and the font default to the theme; a caller colours its own datasets (`ChartThemeService`).
 */
@Component({
    selector: 'app-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './chart.component.html',
    styleUrl: './chart.component.scss',
    host: {
        '[style.height]': 'height()'
    }
})
export class ChartComponent {
    private readonly theme = inject(ChartThemeService);
    private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

    readonly config = input.required<ChartConfiguration>();
    readonly height = input<string>();

    private chart: Chart | undefined;
    private chartType: ChartConfiguration['type'] | undefined;

    constructor() {
        // After render, so the canvas is in the page and sized before Chart.js measures it.
        afterRenderEffect(() => {
            const config = this.config();
            if (this.chart && this.chartType === config.type) {
                this.chart.data = config.data;
                this.chart.options = config.options ?? {};
                this.chart.update();
                return;
            }

            this.chart?.destroy();
            this.chart = undefined;
            const context = this.canvas().nativeElement.getContext('2d');
            if (context) {
                this.applyTheme();
                this.chart = new Chart(context, config);
                this.chartType = config.type;
            }
        });

        inject(DestroyRef).onDestroy(() => this.chart?.destroy());
    }

    private applyTheme(): void {
        const colors = this.theme.colors();
        Chart.defaults.color = colors.text;
        Chart.defaults.borderColor = colors.grid;
        Chart.defaults.font.family = this.theme.fontFamily();
        // Fill the container and follow its size, rather than keeping an aspect ratio.
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        Chart.defaults.elements.line.tension = 0.4;
        Chart.defaults.plugins.tooltip.backgroundColor = colors.tooltip;
        Chart.defaults.plugins.tooltip.titleColor = colors.tooltipText;
        Chart.defaults.plugins.tooltip.bodyColor = colors.tooltipText;
    }
}
