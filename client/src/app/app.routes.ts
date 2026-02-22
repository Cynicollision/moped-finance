import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { FinanceComponent } from './features/finance/finance.component';
import { GroundsComponent } from './features/grounds/grounds.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home' },
  { path: 'login', component: LoginComponent, title: 'Login' },
  { path: 'finance', component: FinanceComponent, title: 'Finance', canActivate: [authGuard] },
  { path: 'grounds', component: GroundsComponent, title: 'Grounds', canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];