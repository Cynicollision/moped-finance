import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '@shared/grounds/types';
import { GroundsService } from './../grounds.service';

@Component({
    selector: 'app-products',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './products.component.html',
    styleUrl: './products.component.scss'
})
export class GroundsProductsComponent implements OnInit {
    private groundsService = inject(GroundsService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    displayedColumns: string[] = ['name', 'manufacturer', 'purposeDescription'];
    dataSource = new MatTableDataSource<Product>([]);

    async ngOnInit() {
        await this.loadData();
    }

    async loadData() {
        const products = await this.groundsService.fetchProducts();
        this.dataSource.data = products || [];
    }

    onRowClick(row: Product) {
        this.router.navigate([row.id], { relativeTo: this.route });
    }

    onAddProduct() {
        this.router.navigate(['new'], { relativeTo: this.route });
    }
}