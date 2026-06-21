import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Environment } from './../../environments/environment';
import { LoadingService } from './loading/loading.service';
import { NotificationService } from './notification.service';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private http = inject(HttpClient);
    private notificationService = inject(NotificationService);
    private loader = inject(LoadingService);
    private baseUrl = Environment.apiUrl;

    private getErrorMessage(error: any): string {
        if (!error) {
            return 'An unknown error occurred';
        }
        if (error.status === 0) {
            return 'Network or server error encountered.';
        }
        if (error.status >= 400 && error.status < 500) {
            const errObj = error.error;
            if (errObj?.message) {
                return errObj.message;
            }
            else if (typeof error.error === 'string') {
                return error.error;
            }
        }
        return error.message || `${error.status} - ${error.statusText}`;
    }

    private async handleRequest<T>(request: Promise<T>): Promise<T | undefined> {
        try {
            const result = await this.loader.withLoading(request);
            return result;
        }
        catch (error: any) {
            this.notificationService.error(this.getErrorMessage(error));
            return undefined;
        }
    }

    get<T>(path: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.get<T>(`${this.baseUrl}/${path}`, { params, withCredentials: true }))
        );
    }

    post<T>(path: string, body: any): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.post<T>(`${this.baseUrl}/${path}`, body, { withCredentials: true }))
        );
    }

    put<T>(path: string, body: any): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.put<T>(`${this.baseUrl}/${path}`, body, { withCredentials: true }))
        );
    }

    async delete(path: string): Promise<boolean> {
        try {
            const request = firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${path}`, { withCredentials: true }));
            await this.loader.withLoading(request);
            return true;
        }
        catch (error: any) {
            this.notificationService.error(this.getErrorMessage(error));
            return false;
        }
    }
}
