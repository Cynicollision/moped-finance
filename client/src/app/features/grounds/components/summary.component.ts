import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-grounds-summary',
    standalone: true,
    imports: [CommonModule, MatCardModule],
    templateUrl: './summary.component.html'
})
export class GroundsSummaryComponent {
    groundsService = inject(GroundsService);
}