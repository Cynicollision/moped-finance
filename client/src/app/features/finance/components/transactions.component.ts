import { Component, ViewChild, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GetTransactionsOptions } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-transactions',
    standalone: true,
    imports: [
        CommonModule,
        MatTableModule,
        MatSortModule,
        MatButtonModule,
        MatIconModule
    ],
    template: `
    <div class="container">
      <table mat-table [dataSource]="dataSource" matSort class="mat-elevation-z8">
        
        <!-- Date Column -->
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef mat-sort-header> Date </th>
          <td mat-cell *matCellDef="let row"> {{row.date | date:'shortDate'}} </td>
        </ng-container>

        <!-- Merchant Column -->
        <ng-container matColumnDef="merchant">
          <th mat-header-cell *matHeaderCellDef mat-sort-header> Merchant </th>
          <td mat-cell *matCellDef="let row"> {{row.merchant}} </td>
        </ng-container>

        <!-- Category Column -->
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef mat-sort-header> Category </th>
          <td mat-cell *matCellDef="let row"> {{row.category}} </td>
        </ng-container>

        <!-- Account Column -->
        <ng-container matColumnDef="account">
          <th mat-header-cell *matHeaderCellDef mat-sort-header> Account </th>
          <td mat-cell *matCellDef="let row"> {{row.account}} </td>
        </ng-container>

        <!-- Amount Column -->
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef mat-sort-header> Amount </th>
          <td mat-cell *matCellDef="let row"> {{row.amount | currency}} </td>
        </ng-container>

        <!-- Actions Column -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef> Actions </th>
          <td mat-cell *matCellDef="let row">
            <button mat-icon-button (click)="viewEditTransaction(row)">
              <mat-icon>edit</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      <div class="footer">
        <button mat-raised-button color="primary" (click)="loadMore()">Load More</button>
      </div>
    </div>
  `,
    styles: [`
    .container { display: flex; flex-direction: column; gap: 16px; }
    .footer { display: flex; justify-content: center; padding: 16px; }
    table { width: 100%; }
  `]
})
export class FinanceTransactionsComponent implements AfterViewInit {
    private financeService = inject(FinanceService);

    displayedColumns: string[] = ['date', 'merchant', 'category', 'account', 'amount', 'actions'];
    dataSource = new MatTableDataSource<Transaction>([]);
    pageSize = 25;

    @ViewChild(MatSort) sort!: MatSort;

    constructor() {
        this.loadData();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    async loadData() {
        // TODO: use options type and add filtering
        const options: GetTransactionsOptions = {
            limit: 25,
            offset: this.dataSource.data.length
        };

        //const currentCount = this.dataSource.data.length;

        const newTransactions: Transaction[] = await this.financeService.fetchTransactions(options) || [];

        // Placeholder: Generate mock data
        
        // const newTransactions: Transaction[] = Array.from({ length: this.pageSize }).map((_, i) => ({
        //     id: `${currentCount + i}`,
        //     merchant: `Merchant ${currentCount + i + 1}`,
        //     category: 'General',
        //     account: 'Checking',
        //     amount: Math.floor(Math.random() * 100)
        // }));

        this.dataSource.data = [...this.dataSource.data, ...newTransactions];
    }

    async loadMore() {
        await this.loadData();
    }

    viewEditTransaction(transaction: Transaction) {
        // STUB: Logic to view or edit the transaction
        console.log('View/Edit', transaction);
    }
}