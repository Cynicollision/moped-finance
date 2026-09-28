import { Injectable, inject } from '@angular/core';
import { CreateApiTokenRequest, CreatedApiToken } from '@shared/core/contracts';
import { ApiToken } from '@shared/core/types';
import { ApiService } from './../core/api.service';

@Injectable({
    providedIn: 'root'
})
export class ApiTokenService {
    private api = inject(ApiService);

    retrieveAll(): Promise<ApiToken[]> {
        return this.api.load<ApiToken[]>('auth/tokens');
    }

    create(request: CreateApiTokenRequest): Promise<CreatedApiToken | undefined> {
        return this.api.post<CreatedApiToken>('auth/tokens', request);
    }

    revoke(id: string): Promise<boolean> {
        return this.api.delete(`auth/tokens/${id}`);
    }
}
