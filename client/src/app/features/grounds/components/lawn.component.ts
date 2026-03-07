import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
  selector: 'app-lawn',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Lawn Care</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <pre>{{ groundsService.lawnData() | json }}</pre>
      </mat-card-content>
    </mat-card>
  `
})
export class LawnComponent {
  groundsService = inject(GroundsService);
}