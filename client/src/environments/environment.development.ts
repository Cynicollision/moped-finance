import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const Environment = {
    production: false,
    isDebugMode: true,
    demoMode: false,
    apiUrl: '',
    devUsername: 'stn',
    devPassword: 'password'
};

export const envProviders: (Provider | EnvironmentProviders)[] = [
    provideHttpClient()
];
