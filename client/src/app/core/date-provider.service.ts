import { Injectable } from '@angular/core';
import { Environment } from './../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class DateProviderService {

    now(): Date {
        // eslint-disable-next-line no-restricted-syntax -- the one place that reads the real clock
        return Environment.isDebugMode ? new Date('2026-05-17T00:00:00') : new Date();
    }
}
