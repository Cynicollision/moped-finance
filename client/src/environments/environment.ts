import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const Environment = {
    production: true,
    isDebugMode: false,
    demoMode: false,
    apiUrl: '',
    devUsername: '',
    devPassword: ''
};

export const envProviders: (Provider | EnvironmentProviders)[] = [
    provideHttpClient()
];
