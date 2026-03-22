import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';

@Component({
    selector: 'app-grounds',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatTabsModule
    ],
    templateUrl: './grounds.component.html'
})
export class GroundsComponent {
    navLinks = [
        { path: 'summary', label: 'Summary' },
        { path: 'schedule', label: 'Schedule' },
        { path: 'plants', label: 'Plants' }
    ];
}