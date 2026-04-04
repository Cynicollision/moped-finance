import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlantVariety, Plant, Location } from '@shared/grounds/types';
import { GroundsService } from './../grounds.service';

export interface PlantCardData {
    id: string;
    commonName: string;
    varietyName?: string;
    category: string;
    locations: string[];
}

@Component({
    selector: 'app-plants',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './plants.component.html',
    styleUrl: './plants.component.scss'
})
export class GroundsPlantsComponent implements OnInit {
    private groundsService = inject(GroundsService);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);

    varieties: PlantVariety[] = [];
    plants: Plant[] = [];
    locations: Location[] = [];
    locationMap = new Map<string, Location>();

    allCards: PlantCardData[] = [];
    filteredCards: PlantCardData[] = [];

    // Filters
    searchText = '';
    selectedCategory = 'All';
    categories: string[] = ['All'];

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const [varieties, plants, locations] = await Promise.all([
            this.groundsService.fetchPlantVarieties(),
            this.groundsService.fetchPlants(),
            this.groundsService.fetchLocations()
        ]);

        this.varieties = varieties || [];
        this.plants = plants || [];
        this.locations = locations || [];

        this.locations.forEach(loc => this.locationMap.set(loc.id, loc));

        // extract categories
        const catSet = new Set<string>();
        this.varieties.forEach(v => catSet.add(v.category));
        this.categories = ['All', ...Array.from(catSet).sort()];

        // map cards
        this.allCards = this.varieties.map(v => {
            const plantsForVariety = this.plants.filter(p => p.varietyId === v.id);
            const locationNames = new Set(
                plantsForVariety
                    .map(p => this.locationMap.get(p.locationId)?.name)
                    .filter((n): n is string => !!n)
            );

            return {
                id: v.id,
                commonName: v.commonName,
                varietyName: v.varietyName,
                category: v.category,
                locations: Array.from(locationNames).sort()
            };
        }).sort((a, b) => a.commonName.localeCompare(b.commonName));

        this.applyFilters();
    }

    applyFilters() {
        const text = this.searchText.toLowerCase().trim();
        this.filteredCards = this.allCards.filter(card => {
            if (this.selectedCategory !== 'All' && card.category !== this.selectedCategory) {
                return false;
            }
            if (text) {
                const searchableFields = [card.commonName, card.varietyName, card.category];
                const matchesSearch = searchableFields
                    .filter(Boolean)
                    .some(field => field!.toLowerCase().includes(text));

                if (!matchesSearch) {
                    return false;
                }
            }
            return true;
        });
        this.cdr.detectChanges();
    }

    onSearchChange() {
        this.applyFilters();
    }

    onCategoryChange() {
        this.applyFilters();
    }

    onCardClick(id: string) {
        this.router.navigate(['/grounds/plants', id]);
    }
}