import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoadingService } from './loading.service';

@Component({
    selector: 'app-loading-overlay',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatProgressSpinnerModule],
    templateUrl: './loading-overlay.component.html',
    styleUrl: './loading-overlay.component.scss'
})
export class LoadingOverlayComponent {
    protected loadingService = inject(LoadingService);
}
