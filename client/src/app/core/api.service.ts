import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  // TODO: In a production app, this URL should come from environment.ts
  private baseUrl = 'http://localhost:3000/api';

  get<T>(path: string, params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> }): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.baseUrl}/${path}`, { params }));
  }

  post<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.baseUrl}/${path}`, body));
  }

  put<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.baseUrl}/${path}`, body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.baseUrl}/${path}`));
  }
}
