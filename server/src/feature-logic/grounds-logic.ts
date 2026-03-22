import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { GroundsData } from './../data-access/grounds-data';

export class GroundsLogic {
    constructor(private groundsData: GroundsData) {
    }

    public async getCareTasks(userId: string, year: string): Promise<CareTask[]> {
        return this.groundsData.careTasks.retrieveAll(userId);
    }

    public async getLocations(userId: string): Promise<Location[]> {
        return this.groundsData.locations.retrieveAll(userId);
    }

    public async getPlants(userId: string): Promise<Plant[]> {
        return this.groundsData.plants.retrieveAll(userId);
    }

    public async getPlantVarieties(userId: string): Promise<PlantVariety[]> {
        return this.groundsData.plantVarieties.retrieveAll(userId);
    }

    public async getProducts(userId: string): Promise<Product[]> {
        return this.groundsData.products.retrieveAll(userId);
    }
}