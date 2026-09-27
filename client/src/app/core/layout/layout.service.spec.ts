import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { LayoutService } from './layout.service';

describe('LayoutService', () => {
    let state: BehaviorSubject<BreakpointState>;

    // Simulates a viewport `width` px wide against whatever queries the service observes.
    function setWidth(width: number, queries: string[]) {
        const breakpoints: Record<string, boolean> = {};
        for (const query of queries) {
            breakpoints[query] = width >= Number(/min-width: (\d+)px/.exec(query)![1]);
        }
        state.next({ matches: Object.values(breakpoints).some(Boolean), breakpoints });
    }

    function createService(width: number): LayoutService {
        state = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
        const observer = {
            observe: (queries: string[]) => {
                setWidth(width, queries);
                return state.asObservable();
            }
        };

        TestBed.configureTestingModule({
            providers: [{ provide: BreakpointObserver, useValue: observer }]
        });
        return TestBed.inject(LayoutService);
    }

    it('should classify widths by the Material 3 window size classes', () => {
        const cases: [number, string][] = [[375, 'compact'], [600, 'medium'], [839, 'medium'], [840, 'expanded'], [1200, 'large']];

        for (const [width, sizeClass] of cases) {
            TestBed.resetTestingModule();
            expect(createService(width).sizeClass(), `${width}px`).toBe(sizeClass);
        }
    });

    it('should compare the current size class with atLeast', () => {
        const layout = createService(900);

        expect(layout.atLeast('medium')).toBe(true);
        expect(layout.atLeast('expanded')).toBe(true);
        expect(layout.atLeast('large')).toBe(false);
        expect(layout.isCompact()).toBe(false);
    });

    it('should update when the viewport changes', () => {
        const layout = createService(1300);
        const queries = Object.keys(state.value.breakpoints);

        setWidth(400, queries);

        expect(layout.sizeClass()).toBe('compact');
        expect(layout.isCompact()).toBe(true);
    });
});
