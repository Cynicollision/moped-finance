import { Signal, computed, resource, signal } from '@angular/core';
import { describeRequestError } from './../api.service';

/**
 * Something a screen loads and shows (APP-2.1, APP-2.9). A thin wrapper over Angular's `resource()`, which is
 * still experimental and clears its value whenever its params change; this keeps the last value on screen while
 * the new one loads, so a timeframe or filter change doesn't blank the screen.
 */
export interface ViewResource<T> {
    /**
     * The latest loaded value, kept while a new one loads. Undefined before the first load and after an error:
     * show placeholders then, never zeros or an empty state.
     */
    readonly value: Signal<T | undefined>;
    /** Loading a new value with the old one still on screen: show the progress bar. */
    readonly isRefreshing: Signal<boolean>;
    /** Why the last load failed, to show in place with Retry. */
    readonly error: Signal<string | undefined>;
    reload(): void;
}

export interface ViewResourceOptions<T, P> {
    /** What to load. The loader runs again whenever this changes; undefined means there's nothing to load. */
    params?: () => P | undefined;
    loader: (params: P) => Promise<T>;
}

export function viewResource<T, P = true>(options: ViewResourceOptions<T, P>): ViewResource<T> {
    // The last value loaded, recorded as each load finishes rather than derived from the resource, which forgets
    // it as soon as the params change. A load overtaken by newer params is ignored.
    const loaded = signal<T | undefined>(undefined);

    const ref = resource({
        params: options.params ?? (() => true as P),
        loader: async ({ params, abortSignal }) => {
            try {
                const value = await options.loader(params as P);
                if (!abortSignal.aborted) {
                    loaded.set(value);
                }
                return value;
            } catch (error) {
                if (!abortSignal.aborted) {
                    loaded.set(undefined);
                }
                // Settle failures into an Error with the message to show; resource() wraps anything else it's thrown.
                throw new Error(describeRequestError(error), { cause: error });
            }
        }
    });

    const value = computed(() => (ref.status() === 'error' ? undefined : loaded()));

    return {
        value,
        isRefreshing: computed(() => ref.isLoading() && value() !== undefined),
        error: computed(() => (ref.status() === 'error' ? ref.error()?.message : undefined)),
        reload: () => {
            ref.reload();
        }
    };
}
