import { Injectable, inject } from '@angular/core';
import { ApiService } from './../../core/api.service';
import { OperationResponse } from '@shared/types/common/operation-response';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Institution } from '@shared/types/finance/entities/institution';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private api = inject(ApiService);

  async getProfile(): Promise<FinanceProfile | undefined> {
    const response = await this.api.get<OperationResponse<FinanceProfile>>(`finance/data/profile?related=institutions,accounts`);
    return response.data;
  }

  async getTestInstitutions(): Promise<Institution[] | undefined> {
    const response = await this.api.get<OperationResponse<Institution[]>>('finance/data/institution');
    return response.data;
  }

}
