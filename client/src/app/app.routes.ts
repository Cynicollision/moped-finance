import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
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
        loadChildren: () => import('./finance/finance.routes').then(m => m.FINANCE_ROUTES),
        title: 'Finance',
        canActivate: [authGuard]
    },
    {
        path: '**',
        redirectTo: ''
    }
];