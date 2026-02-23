import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './../../core/api.service';
import { OperationResponse } from '@shared/types/common/operation-response';
import { Account } from '@shared/types/finance/entities/account';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Institution } from '@shared/types/finance/entities/institution';
import { LoadingService } from '../../core/loading.service';
import { NotificationService } from '../../core/notification.service';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private api = inject(ApiService);
  private loading = inject(LoadingService);
  private notifications = inject(NotificationService);

  profileData = signal<FinanceProfile | undefined>(undefined);
  

  async getProfileData(): Promise<FinanceProfile | undefined> {
    try {
      const response = await this.loading.withLoading(this.api.get<OperationResponse<FinanceProfile>>(`finance/data/profile?related=institutions,accounts`));
      this.profileData.set(response.data);
      return response.data;
    }
    catch (error) {
      console.error('Error fetching profile data:', error);
      this.notifications.error('Unable to load finance profile.');
      return undefined;
    }
  }

  async getTestInstitutions(): Promise<Institution[] | undefined> {
    try {
      const response = await this.loading.withLoading(this.api.get<OperationResponse<Institution[]>>('finance/data/institution'));
      return response.data;
    } catch (error) {
      this.notifications.error('Unable to load institutions.');
      return undefined;
    }
  }

}
