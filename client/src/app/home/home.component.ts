import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Dashboard</mat-card-title></mat-card-header>
      <mat-card-content><p>Welcome to your Home Lab.</p></mat-card-content>
    </mat-card>
  `
})
export class HomeComponent {}