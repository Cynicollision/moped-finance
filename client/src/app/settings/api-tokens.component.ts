import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApiTokenAccess } from '@shared/core/enum';
import { ApiToken } from '@shared/core/types';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { DateProviderService } from './../core/date-provider.service';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { SkeletonComponent } from './../core/loading/skeleton.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { ApiTokenService } from './api-token.service';
import { NewApiTokenDialogComponent } from './new-api-token-dialog.component';

// The API Tokens page of Settings (AUTH-11.1, AUTH-11.5)
@Component({
    selector: 'app-api-tokens',
    imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, PageHeaderComponent, LoadErrorComponent, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './api-tokens.component.html',
    styleUrl: './api-tokens.component.scss'
})
export class ApiTokensComponent {
    private apiTokenService = inject(ApiTokenService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private dateProvider = inject(DateProviderService);

    readonly tokens = viewResource({ loader: () => this.apiTokenService.retrieveAll() });

    accessLabel(access: ApiTokenAccess): string {
        return access === ApiTokenAccess.ReadOnly ? 'Read-only' : 'Read & write';
    }

    isExpired(token: ApiToken): boolean {
        return token.expiresAt !== null && new Date(token.expiresAt) <= this.dateProvider.now();
    }

    async newToken(): Promise<void> {
        // However the dialog closes, a token may have been created.
        await this.modalService.open(NewApiTokenDialogComponent);
        this.tokens.reload();
    }

    async revoke(token: ApiToken): Promise<void> {
        const confirmed = await this.modalService.confirm({
            title: 'Revoke API Token',
            message: `Revoke "${token.name}"? Scripts and tools using it will stop working straight away.`,
            confirmLabel: 'Revoke',
            isWarn: true
        });
        if (confirmed && await this.apiTokenService.revoke(token.id)) {
            this.notificationService.success('Token revoked');
            this.tokens.reload();
        }
    }
}
