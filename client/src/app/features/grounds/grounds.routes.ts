import { Routes } from '@angular/router';
import { GroundsComponent } from './grounds.component';
import { GroundsCalendarComponent } from './components/calendar.component';
import { GroundsPlantsComponent } from './components/plants.component';
import { GroundsProductsComponent } from './components/products.component';
import { GroundsScheduleComponent } from './components/schedule.component';
import { GroundsSummaryComponent } from './components/summary.component';

export const GROUNDS_ROUTES: Routes = [
    {
        path: '',
        component: GroundsComponent,
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: GroundsSummaryComponent },
            { path: 'schedule', component: GroundsScheduleComponent },
            { path: 'calendar', component: GroundsCalendarComponent },
            { path: 'plants', component: GroundsPlantsComponent },
            { path: 'products', component: GroundsProductsComponent }
        ]
    }
];