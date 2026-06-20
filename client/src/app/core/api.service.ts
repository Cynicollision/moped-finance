import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OperationResult } from '@shared/core/contracts';
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
            // TODO: what is this
            if (error.error && error.error.error && error.error.error.message) {
                return error.error.error.message;
            } else if (error.error && typeof error.error === 'string') {
                return error.error;
            }
        }
        return error.message || `${error.status} - ${error.statusText}`;
    }

    private async handleRequest<T>(request: Promise<OperationResult<T>>): Promise<T | undefined> {
        try {
            const response = await this.loader.withLoading(request);
            if (response.success === false) {
                const errMsg = response.error?.message || 'Operation failed';
                this.notificationService.error(errMsg);
                return undefined;
            }
            return response.data as T;
        }
        catch (error: any) {
            this.notificationService.error(this.getErrorMessage(error));
            return undefined;
        }
    }

    get<T>(path: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.get<OperationResult<T>>(`${this.baseUrl}/${path}`, { params, withCredentials: true }))
        );
    }

    post<T>(path: string, body: any): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.post<OperationResult<T>>(`${this.baseUrl}/${path}`, body, { withCredentials: true }))
        );
    }

    put<T>(path: string, body: any): Promise<T | undefined> {
        return this.handleRequest<T>(
            firstValueFrom(this.http.put<OperationResult<T>>(`${this.baseUrl}/${path}`, body, { withCredentials: true }))
        );
    }

    async delete(path: string): Promise<boolean> {
        try {
            const request = firstValueFrom(this.http.delete<OperationResult<void>>(`${this.baseUrl}/${path}`, { withCredentials: true }));
            const response = await this.loader.withLoading(request);
            if (response.success === false) {
                const errMsg = response.error?.message || 'Operation failed';
                this.notificationService.error(errMsg);
                return false;
            }
            return true;
        } catch (error: any) {
            this.notificationService.error(this.getErrorMessage(error));
            return false;
        }
    }
}
