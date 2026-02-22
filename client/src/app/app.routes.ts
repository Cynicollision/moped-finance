import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { FinanceComponent } from './features/finance/finance.component';
import { GroundsComponent } from './features/grounds/grounds.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  { path: 'finance', component: FinanceComponent, title: 'Finance' },
  { path: 'grounds', component: GroundsComponent, title: 'Grounds' },
  { path: '**', redirectTo: '' }
];