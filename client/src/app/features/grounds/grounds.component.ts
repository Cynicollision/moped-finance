import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-grounds',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Grounds</mat-card-title></mat-card-header>
      <mat-card-content><p>Grounds maintenance application placeholder.</p></mat-card-content>
    </mat-card>
  `
})
export class GroundsComponent {}