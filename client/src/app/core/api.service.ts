import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OperationResult } from '@shared/common/contracts';
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
            if (error) {
                this.notificationService.error(`${error.status} - ${error.statusText}`);
            }

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
            if (!error.message || error.status === 0) {
                this.notificationService.error('Network or server error encountered.');
            } else {
                this.notificationService.error(`An error occurred: ${error.message || 'Unknown error'}`);
            }
            return false;
        }
    }
}
