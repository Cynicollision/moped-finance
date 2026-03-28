import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-products',
    standalone: true,
    imports: [CommonModule, MatCardModule],
    templateUrl: './products.component.html'
})
export class GroundsProductsComponent {
    groundsService = inject(GroundsService);
}