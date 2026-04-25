import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '@shared/grounds/types';
import { CareTaskType } from '@shared/grounds/enum';
import { ModalService } from './../../../core/modal/modal.service';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-product-details',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './product-details.component.html',
    styleUrl: './product-details.component.scss'
})
export class GroundsProductDetailsComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private groundsService = inject(GroundsService);
    private fb = inject(FormBuilder);
    private modalService = inject(ModalService);

    isNew = false;
    productId: string | null = null;
    careTaskTypes = Object.values(CareTaskType);

    productForm: FormGroup = this.fb.group({
        name: ['', Validators.required],
        manufacturer: ['', Validators.required],
        careTaskType: [CareTaskType.Other, Validators.required],
        purposeDescription: ['', Validators.required],
        url: ['']
    });

    async ngOnInit() {
        this.productId = this.route.snapshot.paramMap.get('id');
        this.isNew = this.productId === 'new';

        if (!this.isNew && this.productId) {
            await this.loadProduct(this.productId);
        }
    }

    async loadProduct(id: string) {
        const product = await this.groundsService.fetchProduct(id);
        if (product) {
            this.productForm.patchValue({
                name: product.name,
                manufacturer: product.manufacturer,
                careTaskType: product.careTaskType,
                purposeDescription: product.purposeDescription,
                url: product.url
            });
        }
    }

    async onSave() {
        if (this.productForm.invalid) {
            return;
        }

        const formValue = this.productForm.value;

        if (this.isNew) {
            const productToCreate = {
                ...formValue
            } as Product;
            await this.groundsService.createProduct(productToCreate);
        } else if (this.productId) {
            const productToUpdate = {
                id: this.productId,
                ...formValue
            } as Product;
            await this.groundsService.saveProduct(productToUpdate);
        }

        this.goBack();
    }

    async onDelete() {
        if (this.productId && !this.isNew) {
            const confirmed = await this.modalService.confirm({
                title: 'Delete Product',
                message: 'Are you sure you want to delete this product? This action cannot be undone.',
                confirmLabel: 'Delete',
                isWarn: true
            });

            if (confirmed) {
                const success = await this.groundsService.deleteProduct(this.productId);
                if (success) {
                    this.goBack();
                }
            }
        }
    }

    goBack() {
        this.router.navigate(['/grounds/products']);
    }
}
