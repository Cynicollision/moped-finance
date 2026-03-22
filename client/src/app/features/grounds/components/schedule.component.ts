import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from '../grounds.service';

@Component({
    selector: 'app-lawn',
    standalone: true,
    imports: [CommonModule, MatCardModule],
    templateUrl: './schedule.component.html'
})
export class GroundsScheduleComponent {
    groundsService = inject(GroundsService);
}