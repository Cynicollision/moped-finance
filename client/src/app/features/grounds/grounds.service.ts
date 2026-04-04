import { Injectable, inject, signal } from '@angular/core';
import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
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

    fetchPlantVarieties(): Promise<PlantVariety[] | undefined> {
        return this.api.get<PlantVariety[]>('api/grounds/data/plant-varieties');
    }

    fetchPlantVariety(id: string): Promise<PlantVariety | undefined> {
        return this.api.get<PlantVariety>(`api/grounds/data/plant-varieties/${id}`);
    }

    fetchPlants(varietyId?: string): Promise<Plant[] | undefined> {
        const url = varietyId ? `api/grounds/data/plants?varietyId=${varietyId}` : 'api/grounds/data/plants';
        return this.api.get<Plant[]>(url);
    }

    savePlantData(variety: PlantVariety, plants: Partial<Plant>[]): Promise<PlantVariety | undefined> {
        return this.api.put<PlantVariety>(`api/grounds/data/plant-varieties/${variety.id}`, { variety, plants });
    }

    fetchLocations(): Promise<Location[] | undefined> {
        return this.api.get<Location[]>('api/grounds/data/locations');
    }

    fetchProducts(): Promise<Product[] | undefined> {
        return this.api.get<Product[]>('api/grounds/data/products');
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