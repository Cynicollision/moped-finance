import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ApiTokenAccess } from '@shared/core/enum';
import { ApiToken } from '@shared/core/types';
import { DateProviderService } from './../core/date-provider.service';
import { ModalService } from './../core/modal/modal.service';
import { ApiTokenService } from './api-token.service';
import { NewApiTokenDialogComponent } from './new-api-token-dialog.component';

// The API Tokens section of Settings (AUTH-11.1, AUTH-11.5)
@Component({
    selector: 'app-api-tokens',
    standalone: true,
    imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './api-tokens.component.html',
    styleUrl: './api-tokens.component.scss'
})
export class ApiTokensComponent implements OnInit {
    private apiTokenService = inject(ApiTokenService);
    private modalService = inject(ModalService);
    private dateProvider = inject(DateProviderService);

    tokens = signal<ApiToken[]>([]);
    isLoaded = signal(false);

    async ngOnInit(): Promise<void> {
        await this.load();
    }

    accessLabel(access: ApiTokenAccess): string {
        return access === ApiTokenAccess.ReadOnly ? 'Read-only' : 'Read & write';
    }

    isExpired(token: ApiToken): boolean {
        return token.expiresAt !== null && new Date(token.expiresAt) <= this.dateProvider.now();
    }

    async newToken(): Promise<void> {
        const created = await this.modalService.open<NewApiTokenDialogComponent, void, boolean>(NewApiTokenDialogComponent);
        if (created) {
            await this.load();
        }
    }

    async revoke(token: ApiToken): Promise<void> {
        const confirmed = await this.modalService.confirm({
            title: 'Revoke API Token',
            message: `Revoke "${token.name}"? Scripts and tools using it will stop working straight away.`,
            confirmLabel: 'Revoke',
            isWarn: true
        });
        if (confirmed && await this.apiTokenService.revoke(token.id)) {
            await this.load();
        }
    }

    private async load(): Promise<void> {
        this.tokens.set(await this.apiTokenService.retrieveAll());
        this.isLoaded.set(true);
    }
}
