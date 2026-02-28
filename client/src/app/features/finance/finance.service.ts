import { Injectable, inject, signal } from '@angular/core';
import { OperationResponse } from '@shared/types/common/operation-response';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Institution } from '@shared/types/finance/entities/institution';
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
      const task = this.api.get<OperationResponse<FinanceProfile>>(`api/finance/data/profile?related=accounts`);
      const response = await this.loader.withLoading(task);
      this.profileData.set(response.data);
      return response.data;
    }
    catch (error) {
      this.notificationService.error(`Unable to load finance profile: ${JSON.stringify(error)}`);
      return undefined;
    }
  }
}
