import { Component, inject, OnInit, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceService } from './../finance.service';

@Component({
  selector: 'app-finance-summary',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './summary.component.html'
})
export class FinanceSummaryComponent implements OnInit {
  private financeService = inject(FinanceService);

  institutions = signal<Institution[] | undefined>(undefined);

  async ngOnInit() {
    const debug = this.financeService.getTestInstitutions();
    console.log(debug);
    this.institutions.set(await this.financeService.getTestInstitutions());
  }
}