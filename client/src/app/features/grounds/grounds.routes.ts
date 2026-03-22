import { Routes } from '@angular/router';
import { GroundsComponent } from './grounds.component';
import { GroundsSummaryComponent } from './components/summary.component';
import { GroundsScheduleComponent } from './components/schedule.component';
import { GroundsPlantsComponent } from './components/plants.component';

export const GROUNDS_ROUTES: Routes = [
    {
        path: '',
        component: GroundsComponent,
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: GroundsSummaryComponent },
            { path: 'schedule', component: GroundsScheduleComponent },
            { path: 'plants', component: GroundsPlantsComponent }
        ]
    }
];