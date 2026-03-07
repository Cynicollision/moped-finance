import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, lastValueFrom } from 'rxjs';
import { OperationResult } from '@shared/core/contracts';
import { ApiService } from './../../core/api.service';
import { LoadingService } from './../../core/loading.service';
import { NotificationService } from './../../core/notification.service';

@Injectable({
  providedIn: 'root'
})
export class GroundsService {
  private api = inject(ApiService);
  private loader = inject(LoadingService);
  private notificationService = inject(NotificationService);

  // Signals to hold state for subcomponents
  plantsData = signal<any[] | undefined>([]);
  lawnData = signal<any | undefined>(undefined);

  async fetchGroundsData(): Promise<void> {
    try {
      // Fetch all required data in parallel
      const task = lastValueFrom(forkJoin({
        plants: this.api.get<OperationResult<any[]>>('api/grounds/data/plants'),
        lawn: this.api.get<OperationResult<any>>('api/grounds/data/lawn'),
      }));

      const response = await this.loader.withLoading(task);

      if (response.plants.success) {
        this.plantsData.set(response.plants.data);
      }
      if (response.lawn.success) {
        this.lawnData.set(response.lawn.data);
      }

    } catch (error) {
      this.notificationService.error(`Unable to load grounds data: ${JSON.stringify(error)}`);
    }
  }
}