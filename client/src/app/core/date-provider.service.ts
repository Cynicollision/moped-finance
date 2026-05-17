import { Injectable } from '@angular/core';
import { Environment } from './../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class DateProviderService {

    now(): Date {
        return Environment.isDebugMode ? new Date('2026-05-17T00:00:00') : new Date();
    }
}
