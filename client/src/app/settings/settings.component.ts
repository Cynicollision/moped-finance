import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from './../core/layout/page-header.component';

interface SettingsSection {
    label: string;
    description: string;
    route: string;
    icon: string;
}

// The Settings screen (SET-1.1): a list of sections, each its own page. Sections not built yet are left out.
@Component({
    selector: 'app-settings',
    imports: [RouterLink, MatIconModule, PageHeaderComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.scss'
})
export class SettingsComponent {
    readonly sections: SettingsSection[] = [
        {
            label: 'Profile',
            description: 'Your username and display name',
            route: '/settings/profile',
            icon: 'person'
        },
        {
            label: 'Appearance',
            description: 'Dark or light',
            route: '/settings/appearance',
            icon: 'palette'
        },
        {
            label: 'Dashboard',
            description: 'How the Dashboard shows your information',
            route: '/settings/dashboard',
            icon: 'dashboard'
        },
        {
            label: 'Institutions and Accounts',
            description: 'Banks, brokerages, lenders and their accounts',
            route: '/settings/institutions',
            icon: 'account_balance'
        },
        {
            label: 'Categories',
            description: 'Income, expense and transfer categories, and their groups',
            route: '/settings/categories',
            icon: 'category'
        },
        {
            label: 'Change Password',
            description: 'The password you sign in with',
            route: '/settings/change-password',
            icon: 'password'
        },
        {
            label: 'API Tokens',
            description: 'Let scripts and tools call the API',
            route: '/settings/api-tokens',
            icon: 'key'
        }
    ];
}
