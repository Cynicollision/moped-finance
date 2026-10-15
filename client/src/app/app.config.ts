import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { PageTitleStrategy } from './core/layout/page-title.strategy';
import { ThemeService } from './core/theme/theme.service';
import { envProviders } from '../environments/environment';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
        ...envProviders,
        provideAppInitializer(() => inject(AuthService).checkSession()),
        // Starts following the theme setting (SET-3.1)
        provideAppInitializer(() => {
            inject(ThemeService);
        })
    ]
};
