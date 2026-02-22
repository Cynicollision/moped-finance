import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Finance</mat-card-title></mat-card-header>
      <mat-card-content><p>Financial application placeholder.</p></mat-card-content>
    </mat-card>
  `
})
export class FinanceComponent {}