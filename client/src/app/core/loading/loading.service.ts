import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LoadingService {
    // Signal to track loading state
    readonly isLoading = signal<boolean>(false);

    private _requestCount = 0;

    show(): void {
        this._requestCount++;
        this.isLoading.set(true);
    }

    hide(): void {
        this._requestCount--;
        if (this._requestCount <= 0) {
            this._requestCount = 0;
            this.isLoading.set(false);
        }
    }

    async withLoading<T>(promise: Promise<T>): Promise<T> {
        try {
            this.show();
            return await promise;
        } finally {
            this.hide();
        }
    }
}