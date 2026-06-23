import { Provider, EnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { demoInterceptor } from '../app/core/demo/demo.interceptor';

export const Environment = {
    production: true,
    isDebugMode: false,
    demoMode: true,
    apiUrl: '',
    devUsername: '',
    devPassword: ''
};

export const envProviders: (Provider | EnvironmentProviders)[] = [
    provideHttpClient(withInterceptors([demoInterceptor]))
];
