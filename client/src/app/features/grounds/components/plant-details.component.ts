import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { PlantVariety, Plant, Location } from '@shared/grounds/types';
import { DateProviderService } from './../../../core/date-provider.service';
import { NotificationService } from './../../../core/notification.service';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-plant-details',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTableModule
    ],
    templateUrl: './plant-details.component.html',
    styleUrl: './plant-details.component.scss'
})
export class GroundsPlantDetailsComponent implements OnInit {
    private groundsService = inject(GroundsService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private cdr = inject(ChangeDetectorRef);
    private dateProvider = inject(DateProviderService);
    private notificationService = inject(NotificationService);

    varietyForm = new FormGroup({
        commonName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        varietyName: new FormControl<string>('', { nonNullable: true }),
        category: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        brandName: new FormControl<string>('', { nonNullable: true }),
        description: new FormControl<string>('', { nonNullable: true }),
        fertilizerNotes: new FormControl<string>('', { nonNullable: true }),
        pruningNotes: new FormControl<string>('', { nonNullable: true }),
        soilNotes: new FormControl<string>('', { nonNullable: true }),
        sunlightNotes: new FormControl<string>('', { nonNullable: true }),
        wateringNotes: new FormControl<string>('', { nonNullable: true })
    });

    varietyId: string | null = null;
    variety = signal<PlantVariety | null>(null);
    originalVarietyName = signal<string>('');
    originalCommonName = signal<string>('');

    // Plants/Locations table
    plants = signal<Partial<Plant>[]>([]);
    availableLocations = signal<Location[]>([]);
    locationMap = new Map<string, Location>();

    displayedColumns: string[] = ['locationId', 'plantedDate', 'actions'];

    // Add new location controls
    newLocationId = new FormControl<string>('');
    newLocationDate = new FormControl<Date>(this.dateProvider.now());

    async ngOnInit() {
        this.varietyId = this.route.snapshot.paramMap.get('id');

        const locations = await this.groundsService.fetchLocations();
        if (locations) {
            this.availableLocations.set(locations);
            locations.forEach(loc => this.locationMap.set(loc.id, loc));
            // default dropdown selection
            if (locations.length > 0) {
                this.newLocationId.setValue(locations[0].id);
            }
        }

        if (this.varietyId) {
            const variety = await this.groundsService.fetchPlantVariety(this.varietyId);
            if (variety) {
                this.originalCommonName.set(variety.commonName);
                this.originalVarietyName.set(variety.varietyName || '');

                this.varietyForm.patchValue({
                    commonName: variety.commonName,
                    varietyName: variety.varietyName || '',
                    category: variety.category,
                    brandName: variety.brandName || '',
                    description: variety.description || '',
                    fertilizerNotes: variety.fertilizerNotes || '',
                    pruningNotes: variety.pruningNotes || '',
                    soilNotes: variety.soilNotes || '',
                    sunlightNotes: variety.sunlightNotes || '',
                    wateringNotes: variety.wateringNotes || ''
                });

                this.variety.set(variety);

                // Fetch plants for this variety
                const plants = await this.groundsService.fetchPlants(this.varietyId);
                if (plants) {
                    this.plants.set(plants);
                }

                this.cdr.detectChanges();
            }
        }
    }

    getLocationName(locationId: string): string {
        return this.locationMap.get(locationId)?.name || 'Unknown Location';
    }

    addPlant() {
        const locId = this.newLocationId.value;
        const date = this.newLocationDate.value;

        if (locId && date) {
            const newPlant: Partial<Plant> = {
                id: '', // Empty ID signifies it's new
                varietyId: this.varietyId || '',
                locationId: locId,
                plantedDate: date
            };

            this.plants.update(current => [...current, newPlant]);

            // Reset date to today after adding
            this.newLocationDate.setValue(this.dateProvider.now());
        }
    }

    removePlant(plant: Partial<Plant>) {
        this.plants.update(current => current.filter(p => p !== plant));
    }

    async save() {
        const varietyRecord = this.variety();
        if (!varietyRecord || this.varietyForm.invalid) {
            return;
        }

        const formValue = this.varietyForm.getRawValue();

        const updatedVariety: PlantVariety = {
            ...varietyRecord,
            commonName: formValue.commonName,
            varietyName: formValue.varietyName || undefined,
            category: formValue.category,
            brandName: formValue.brandName || undefined,
            description: formValue.description || undefined,
            fertilizerNotes: formValue.fertilizerNotes || undefined,
            pruningNotes: formValue.pruningNotes || undefined,
            soilNotes: formValue.soilNotes || undefined,
            sunlightNotes: formValue.sunlightNotes || undefined,
            wateringNotes: formValue.wateringNotes || undefined
        };

        const result = await this.groundsService.savePlantData(updatedVariety, this.plants());
        if (result) {
            this.notificationService.success('Plant details saved successfully.');
        }
    }

    cancel() {
        this.router.navigate(['/grounds/plants']);
    }
}
