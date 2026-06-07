import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-finance',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule
    ],
    templateUrl: './finance.component.html'
})
export class FinanceComponent {
}