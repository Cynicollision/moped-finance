import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-grounds',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule
    ],
    templateUrl: './grounds.component.html'
})
export class GroundsComponent {
}