import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { GroundsComponent } from './features/grounds/grounds.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
    {
        path: '', component: HomeComponent,
        title: 'Home'
    },
    {
        path: 'login', component: LoginComponent,
        title: 'Login'
    },
    {
        path: 'finance',
        loadChildren: () => import('./features/finance/finance.routes').then(m => m.FINANCE_ROUTES),
        title: 'Finance',
        canActivate: [authGuard]
    },
    {
        path: 'grounds',
        loadChildren: () => import('./features/grounds/grounds.routes').then(m => m.GROUNDS_ROUTES),
        title: 'Grounds',
        canActivate: [authGuard]
    },
    {
        path: '**',
        redirectTo: ''
    }
];