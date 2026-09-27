import { ChangeDetectionStrategy, Component, ElementRef, OnChanges, OnDestroy, OnInit, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

export type { ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

// Global defaults for Dark Theme
Chart.defaults.color = '#efefef'; // --text-main
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.12)'; // --border-color
Chart.defaults.elements.line.tension = 0.4; // Slightly smoother lines by default
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.08)';
Chart.defaults.plugins.tooltip.backgroundColor = '#1e1e1e';
Chart.defaults.plugins.tooltip.titleColor = '#efefef';
Chart.defaults.plugins.tooltip.bodyColor = '#efefef';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.12)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

@Component({
    selector: 'app-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './chart.component.html',
    styleUrl: './chart.component.scss',
    host: {
        '[style.height]': 'height()',
        '[style.width]': 'width()'
    }
})
export class ChartComponent implements OnInit, OnChanges, OnDestroy {
    readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

    readonly config = input.required<ChartConfiguration>();
    readonly height = input<string>();
    readonly width = input<string>();

    private chart: Chart | undefined;
    private initialized = false;
    private destroyed = false;

    ngOnInit(): void {
        this.initialized = true;
        this.createChart();
    }

    ngOnChanges(): void {
        if (this.initialized) {
            this.createChart();
        }
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        if (this.chart) {
            this.chart.destroy();
        }
    }

    private createChart(): void {
        if (!this.initialized) {
            return;
        }

        // Use setTimeout to ensure the DOM is fully rendered and sized before Chart.js measures it
        setTimeout(() => {
            if (this.destroyed) {
                return;
            }

            const ctx = this.chartCanvas().nativeElement.getContext('2d');
            if (ctx) {
                if (this.chart) {
                    this.chart.destroy();
                }
                this.chart = new Chart(ctx, this.config());
            }
        });
    }
}
