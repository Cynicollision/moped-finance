import { Component, OnInit, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { PlantsComponent } from './components/plants.component';
import { LawnComponent } from './components/lawn.component';
import { SettingsComponent } from './components/settings.component';
import { GroundsService } from './grounds.service';

@Component({
  selector: 'app-grounds',
  standalone: true,
  imports: [
    MatTabsModule,
    PlantsComponent,
    LawnComponent,
    SettingsComponent
  ],
  template: `
    <div class="container">
      <h2>Grounds Management</h2>
      <mat-tab-group animationDuration="0ms">
        <mat-tab label="Plants">
          <app-plants></app-plants>
        </mat-tab>
        <mat-tab label="Lawn">
          <app-lawn></app-lawn>
        </mat-tab>
        <mat-tab label="Settings">
          <app-grounds-settings></app-grounds-settings>
        </mat-tab>
      </mat-tab-group>
    </div>
  `
})
export class GroundsComponent implements OnInit {
  private groundsService = inject(GroundsService);

  ngOnInit(): void {
    this.groundsService.fetchGroundsData();
  }
}