import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-plants',
    standalone: true,
    imports: [CommonModule, MatCardModule],
    templateUrl: './plants.component.html'
})
export class GroundsPlantsComponent {
    groundsService = inject(GroundsService);
}