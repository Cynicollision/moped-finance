import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Environment } from './../../environments/environment';
import { NotificationService } from './notification.service';

type QueryParams = HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;

/** The message to show for a failed request (APP-2.2). */
export function describeRequestError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
        return 'An unknown error occurred';
    }
    if (error.status === 0) {
        return 'Network or server error encountered.';
    }
    if (error.status >= 400 && error.status < 500) {
        if (typeof error.error?.message === 'string') {
            return error.error.message;
        }
        else if (typeof error.error === 'string') {
            return error.error;
        }
    }
    return error.message || `${error.status} - ${error.statusText}`;
}

/**
 * All HTTP goes through here. There are two kinds of request:
 *
 * - `load` fetches what a screen shows. It throws on failure, so the screen can show the error in place with
 *   Retry (APP-2.9); use it through `viewResource`.
 * - `get`, `post`, `put` and `delete` are actions (and the session checks in `AuthService`). A failure shows an
 *   error snackbar (APP-2.2) and resolves to undefined (false for `delete`).
 */
@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private http = inject(HttpClient);
    private notificationService = inject(NotificationService);
    private baseUrl = Environment.apiUrl;

    load<T>(path: string, params?: QueryParams): Promise<T> {
        return firstValueFrom(this.http.get<T>(`${this.baseUrl}/${path}`, { params }));
    }

    get<T>(path: string, params?: QueryParams): Promise<T | undefined> {
        return this.handleRequest(this.load<T>(path, params));
    }

    post<T>(path: string, body: unknown): Promise<T | undefined> {
        return this.handleRequest(firstValueFrom(this.http.post<T>(`${this.baseUrl}/${path}`, body)));
    }

    put<T>(path: string, body: unknown): Promise<T | undefined> {
        return this.handleRequest(firstValueFrom(this.http.put<T>(`${this.baseUrl}/${path}`, body)));
    }

    async delete(path: string): Promise<boolean> {
        const result = await this.handleRequest(firstValueFrom(this.http.delete(`${this.baseUrl}/${path}`)).then(() => true));
        return result ?? false;
    }

    private async handleRequest<T>(request: Promise<T>): Promise<T | undefined> {
        try {
            return await request;
        }
        catch (error) {
            this.notificationService.error(describeRequestError(error));
            return undefined;
        }
    }
}
