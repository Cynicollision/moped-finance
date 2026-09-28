import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { viewResource } from './view-resource';

describe('viewResource', () => {
    /** A loader whose calls stay pending until the test settles them. */
    function deferredLoader<P, T>() {
        const calls: { params: P, resolve: (value: T) => void, reject: (error: unknown) => void }[] = [];
        const loader = (params: P) => new Promise<T>((resolve, reject) => calls.push({ params, resolve, reject }));
        return { loader, calls };
    }

    function create<T, P>(options: Parameters<typeof viewResource<T, P>>[0]) {
        return runInInjectionContext(TestBed.inject(Injector), () => viewResource(options));
    }

    async function settle() {
        await TestBed.inject(ApplicationRef).whenStable();
    }

    it('APP-2.1 should have no value until the first load, so screens show placeholders', async () => {
        const { loader, calls } = deferredLoader<true, number[]>();
        const resource = create({ loader });
        TestBed.tick();

        expect(resource.value()).toBeUndefined();
        expect(resource.isRefreshing()).toBe(false);

        calls[0].resolve([1, 2]);
        await settle();
        expect(resource.value()).toEqual([1, 2]);
    });

    it('APP-2.1 should keep the old value on screen while new params load, and report it as refreshing', async () => {
        const timeframe = signal('30D');
        const { loader, calls } = deferredLoader<string, string>();
        const resource = create({ params: () => timeframe(), loader });
        TestBed.tick();
        calls[0].resolve('30 days');
        await settle();

        timeframe.set('1Y');
        TestBed.tick();

        expect(calls.map(call => call.params)).toEqual(['30D', '1Y']);
        expect(resource.value()).toBe('30 days');
        expect(resource.isRefreshing()).toBe(true);

        calls[1].resolve('1 year');
        await settle();
        expect(resource.value()).toBe('1 year');
        expect(resource.isRefreshing()).toBe(false);
    });

    it('APP-2.9 should report a failed load as a message, and load again on reload', async () => {
        const { loader, calls } = deferredLoader<true, string>();
        const resource = create({ loader });
        TestBed.tick();

        calls[0].reject(new HttpErrorResponse({ status: 0 }));
        await settle();
        expect(resource.error()).toBe('Network or server error encountered.');
        expect(resource.value()).toBeUndefined();

        resource.reload();
        TestBed.tick();
        calls[1].resolve('loaded');
        await settle();
        expect(resource.error()).toBeUndefined();
        expect(resource.value()).toBe('loaded');
    });

    it('should not load while its params are undefined', async () => {
        const id = signal<string | undefined>(undefined);
        const { loader, calls } = deferredLoader<string, string>();
        create({ params: () => id(), loader });
        TestBed.tick();

        expect(calls).toEqual([]);

        id.set('acct-1');
        TestBed.tick();
        expect(calls.map(call => call.params)).toEqual(['acct-1']);
    });
});
