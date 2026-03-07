import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
  selector: 'app-plants',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Plants</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Total Plants: {{ groundsService.plantsData()?.length }}</p>
        <!-- Plant list implementation would go here -->
      </mat-card-content>
    </mat-card>
  `
})
export class PlantsComponent {
  groundsService = inject(GroundsService);
}