import { TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js';
import { ChartComponent, ChartConfiguration } from './chart.component';

describe('ChartComponent', () => {
    // jsdom has no canvas drawing or ResizeObserver: give Chart.js a 2D context that ignores drawing, and an
    // observer that never fires.
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
            return fakeContext(this);
        });
    });

    function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
        const state: Record<string | symbol, unknown> = {};
        return new Proxy(state, {
            get: (target, property) => {
                if (property === 'canvas') {
                    return canvas;
                }
                // Chart.js reads `length` to tell a list of canvases from one.
                if (property === 'length') {
                    return undefined;
                }
                if (property === 'measureText') {
                    return (text?: string) => ({ width: (text ?? '').length * 6 });
                }
                return property in target ? target[property] : () => undefined;
            },
            set: (target, property, value) => {
                target[property] = value;
                return true;
            }
        }) as unknown as CanvasRenderingContext2D;
    }

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function line(data: number[]): ChartConfiguration {
        return {
            type: 'line',
            data: { labels: data.map((_, i) => `Day ${i + 1}`), datasets: [{ data }] },
            options: { animation: false }
        };
    }

    async function render(config: ChartConfiguration) {
        const fixture = TestBed.createComponent(ChartComponent);
        fixture.componentRef.setInput('config', config);
        await fixture.whenStable();
        const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
        return { fixture, canvas };
    }

    it('should draw the chart once the view has rendered, following its container', async () => {
        const { canvas } = await render(line([1, 2, 3]));

        const chart = Chart.getChart(canvas)!;
        expect(chart).toBeDefined();
        expect(chart.options.responsive).toBe(true);
        expect(chart.options.maintainAspectRatio).toBe(false);
    });

    it('should update the chart in place when the config changes', async () => {
        const { fixture, canvas } = await render(line([1, 2, 3]));
        const chart = Chart.getChart(canvas)!;

        fixture.componentRef.setInput('config', line([4, 5]));
        await fixture.whenStable();

        expect(Chart.getChart(canvas)).toBe(chart);
        expect(chart.data.datasets[0].data).toEqual([4, 5]);
    });

    it('should draw a new chart when the chart type changes', async () => {
        const { fixture, canvas } = await render(line([1, 2, 3]));
        const chart = Chart.getChart(canvas)!;

        fixture.componentRef.setInput('config', { ...line([1, 2, 3]), type: 'bar' });
        await fixture.whenStable();

        expect(Chart.getChart(canvas)).not.toBe(chart);
        expect((Chart.getChart(canvas)!.config as ChartConfiguration).type).toBe('bar');
    });

    it('should destroy the chart with the component', async () => {
        const { fixture, canvas } = await render(line([1, 2, 3]));

        fixture.destroy();

        expect(Chart.getChart(canvas)).toBeUndefined();
    });
});
