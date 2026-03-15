import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

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
export class FinanceComponent {
    navLinks = [
        { path: 'summary', label: 'Dashboard' },
        { path: 'transactions', label: 'Transactions' },
        { path: 'budget', label: 'Budget' },
        { path: 'spending', label: 'Spending' }
    ];
}