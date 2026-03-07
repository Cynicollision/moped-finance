import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { OperationResult } from '@shared/types/operation-result';
import { FinanceProfile, Institution, Account, Category } from '@shared/types/entities/finance';
import { ApiService } from './../../core/api.service';
import { LoadingService } from './../../core/loading.service';
import { NotificationService } from './../../core/notification.service';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private loader = inject(LoadingService);
    private notificationService = inject(NotificationService);

    profileData = signal<FinanceProfile | undefined>(undefined);

    async fetchProfileData(): Promise<FinanceProfile | undefined> {
        try {
            const task = lastValueFrom(forkJoin({
                profile: this.api.get<OperationResult<FinanceProfile>>('api/finance/data/profile'),
                accounts: this.api.get<OperationResult<Account[]>>('api/finance/data/accounts'),
                institutions: this.api.get<OperationResult<Institution[]>>('api/finance/data/institutions'),
                categories: this.api.get<OperationResult<Category[]>>('api/finance/data/categories')
            }).pipe(
                map(({ profile, accounts, institutions, categories }) => {
                    const fullProfile = <FinanceProfile>profile.data;
                    fullProfile.accounts = accounts.data;
                    fullProfile.institutions = institutions.data;
                    fullProfile.categories = categories.data;
                    return fullProfile;
                })
            ));

            const response = await this.loader.withLoading(task);
            this.profileData.set(response);
            return response;
        }
        catch (error) {
            this.notificationService.error(`Unable to load finance profile: ${JSON.stringify(error)}`);
            return undefined;
        }
    }
}
