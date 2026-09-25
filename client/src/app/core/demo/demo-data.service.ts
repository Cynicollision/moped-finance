import { Injectable } from '@angular/core';
import { User } from '@shared/core/types/user';

@Injectable({
    providedIn: 'root'
})
export class DemoDataService {
    
    private readonly STORAGE_KEY = 'moped_finance_demo_data';
    private data: any;

    constructor() {
        this.loadData();
    }

    private loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                this.data = JSON.parse(stored);
            } catch {
                this.initData();
            }
        } else {
            this.initData();
        }
    }

    private initData() {
        this.data = {
            isLoggedIn: false
        };
        this.saveData();
    }

    private saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    getMe(): User | null {
        if (!this.data.isLoggedIn) return null;
        return {
            id: 'demo-user-id',
            username: 'demo',
            displayName: 'Demo User',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    login(): User {
        this.data.isLoggedIn = true;
        this.saveData();
        return this.getMe()!;
    }

    logout() {
        this.data.isLoggedIn = false;
        this.saveData();
    }
}
