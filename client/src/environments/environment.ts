import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const Environment = {
    production: true,
    isDebugMode: false,
    demoMode: false,
    apiUrl: 'http://localhost:3000',
    devUsername: '',
    devPassword: ''
};

export const envProviders: (Provider | EnvironmentProviders)[] = [
    provideHttpClient()
];
