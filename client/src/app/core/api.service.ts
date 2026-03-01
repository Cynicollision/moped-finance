import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OperationResult } from '@shared/types/common/operation-response';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  // TODO: In a production app, this URL should come from environment.ts
  private baseUrl = 'http://localhost:3000';

  get<T>(path: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.baseUrl}/${path}`, { params, withCredentials: true }));
  }

  post<T>(path: string, body: any): Promise<OperationResult<T>> {
    return firstValueFrom(this.http.post<OperationResult<T>>(`${this.baseUrl}/${path}`, body, { withCredentials: true }));
  }

  put<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.baseUrl}/${path}`, body, { withCredentials: true }));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.baseUrl}/${path}`, { withCredentials: true }));
  }
}
