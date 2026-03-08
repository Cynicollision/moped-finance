import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { FinanceProfile } from '@shared/finance/types';
import { FinanceService } from './finance.service';

@Component({
    selector: 'app-finance',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatTabsModule
    ],
    templateUrl: './finance.component.html'
})
export class FinanceComponent implements OnInit {
    private financeService = inject(FinanceService);

    profileData = signal<FinanceProfile | undefined>(undefined);

    navLinks = [
        { path: 'summary', label: 'Summary' },
        { path: 'accounts', label: 'Accounts' },
        { path: 'transactions', label: 'Transactions' },
        { path: 'reports', label: 'Reports' },
        { path: 'settings', label: 'Settings' }
    ];

    async ngOnInit() {
        const data = await this.financeService.fetchProfileData();
        this.profileData.set(data);
    }
}