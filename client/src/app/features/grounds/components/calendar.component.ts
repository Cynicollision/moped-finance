import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'app-grounds-calendar',
    standalone: true,
    imports: [CommonModule, MatCardModule],
    templateUrl: './calendar.component.html'
})
export class GroundsCalendarComponent {
}
