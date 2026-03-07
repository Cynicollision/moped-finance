import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
  selector: 'app-grounds-settings',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Settings</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Configuration options for grounds management.</p>
      </mat-card-content>
    </mat-card>
  `
})
export class SettingsComponent {
  groundsService = inject(GroundsService);
}