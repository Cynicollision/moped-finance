import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, lastValueFrom } from 'rxjs';
import { CareTask } from '@shared/grounds/types/care-task';
import { ApiService } from './../../core/api.service';

@Injectable({
    providedIn: 'root'
})
export class GroundsService {
    private api = inject(ApiService);

    // Signals to hold state for subcomponents
    plantsData = signal<any[] | undefined>([]);
    lawnData = signal<any | undefined>(undefined);

    fetchTasks(year?: number): Promise<CareTask[] | undefined> {
        return this.api.get<CareTask[]>(`api/grounds/data/tasks?year=${year}`);
    }

    fetchProducts(): Promise<any[] | undefined> {
        return this.api.get<any[]>('api/grounds/data/products');
    }

    createTask(careTask: CareTask): Promise<CareTask | undefined> {
        return this.api.post<CareTask>('api/grounds/data/tasks', careTask);
    }

    saveTask(careTask: CareTask): Promise<CareTask | undefined> {
        return this.api.put<CareTask>(`api/grounds/data/tasks/${careTask.id}`, careTask);
    }

    deleteTask(id: string): Promise<boolean> {
        return this.api.delete(`api/grounds/data/tasks/${id}`);
    }
}