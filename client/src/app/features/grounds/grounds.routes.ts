import { Routes } from '@angular/router';
import { GroundsComponent } from './grounds.component';

import { GroundsPlantsComponent } from './components/plants.component';
import { GroundsProductsComponent } from './components/products.component';
import { GroundsScheduleComponent } from './components/schedule.component';
import { GroundsSummaryComponent } from './components/summary.component';
import { GroundsPlantDetailsComponent } from './components/plant-details.component';
import { GroundsProductDetailsComponent } from './components/product-details.component';

export const GROUNDS_ROUTES: Routes = [
    {
        path: '',
        component: GroundsComponent,
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: GroundsSummaryComponent },
            { path: 'schedule', component: GroundsScheduleComponent },

            { path: 'plants', component: GroundsPlantsComponent },
            { path: 'plants/:id', component: GroundsPlantDetailsComponent },
            { path: 'products', component: GroundsProductsComponent },
            { path: 'products/:id', component: GroundsProductDetailsComponent }
        ]
    }
];