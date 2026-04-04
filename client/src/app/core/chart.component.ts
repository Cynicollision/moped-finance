import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
    standalone: true,
    templateUrl: './chart.component.html',
    styles: [`
        :host {
            display: block;
            width: 100%;
            height: 100%;
        }
    `]
})
export class ChartComponent implements OnInit, OnChanges, OnDestroy {
    @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;

    @Input() config!: ChartConfiguration;
    @Input() height?: string;
    @Input() width?: string;

    private chart: Chart | undefined;

    ngOnInit(): void {
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
