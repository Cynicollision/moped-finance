import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

export type { ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

@Component({
    selector: 'app-chart',
    standalone: true,
    template: `
    <div class="chart-container" style="position: relative; width: 100%; height: 100%;">
      <canvas #chartCanvas></canvas>
    </div>
  `
})
export class ChartComponent implements OnInit, OnChanges, OnDestroy {
    @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;

    @Input() config!: ChartConfiguration;
    @Input() height?: string;
    @Input() width?: string;

    private chart: Chart | undefined;

    ngOnInit(): void {
        if (this.height) {
            this.chartCanvas.nativeElement.style.height = this.height;
        }
        if (this.width) {
            this.chartCanvas.nativeElement.style.width = this.width;
        }
        this.createChart();
    }

    ngOnChanges(): void {
        if (this.chart) {
            this.chart.destroy();
            this.createChart();
        }
    }

    ngOnDestroy(): void {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    private createChart(): void {
        if (!this.config) return;

        const ctx = this.chartCanvas.nativeElement.getContext('2d');
        if (ctx) {
            this.chart = new Chart(ctx, this.config);
        }
    }
}
