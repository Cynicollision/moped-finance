import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** What every import endpoint reports, on a dry run and a real one. */
export interface ImportReport {
    /** True when no row has an error. Imports are all-or-nothing, so only a valid file is saved. */
    isValidToImport: boolean;
    resultMessage: string;
    /** One message per invalid row, such as "Row 3: Amount 'abc' is not a number." */
    failedRowMessages: string[];
}

interface ImportErrors {
    message: string;
    rows: string[];
}

/**
 * The CSV import flow every import screen shares (TXN-3.3, TXN-3.7, ACCT-3.3, ACCT-3.7): choose a file, validate it with
 * a dry run, show the row errors or a confirm panel, then import. The screen supplies `run`, which posts the file, and
 * projects the confirm panel's summary, reading the dry run's report from `dryRun()` through a template reference.
 */
@Component({
    selector: 'app-csv-import',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './csv-import.component.html',
    styleUrl: './csv-import.component.scss'
})
export class CsvImportComponent<T extends ImportReport> {
    /** What the file holds, finishing "Select a CSV file containing …": "your transactions". */
    readonly subject = input.required<string>();
    /** The columns the file must have, as listed to the user: "Date, AccountName, Balance". */
    readonly columns = input.required<string>();
    /** Columns the file may also have, listed after the required ones: "Id". */
    readonly optionalColumns = input('');
    /** Posts the file, as a dry run or for real. Resolves undefined when the request failed (ApiService reports it). */
    readonly run = input.required<(form: FormData, dryRun: boolean) => Promise<T | undefined>>();
    /** Marks the confirm panel with a warning, for an import that replaces what's there. */
    readonly replaces = input(false);
    /** Emits the real import's report once it has saved. */
    readonly imported = output<T>();

    readonly selectedFile = signal<File | null>(null);
    readonly isProcessing = signal(false);
    /** The clean dry run's report, which the confirm panel shows. */
    readonly dryRun = signal<T | null>(null);
    /** The summary and each failed row's message. */
    readonly validationError = signal<ImportErrors | null>(null);

    onFileSelected(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.selectedFile.set(file);
            this.dryRun.set(null);
            this.validationError.set(null);
        }
    }

    async validate() {
        const report = await this.send(true);
        if (report?.isValidToImport) {
            this.dryRun.set(report);
        }
    }

    async confirm() {
        const report = await this.send(false);
        if (report?.isValidToImport) {
            this.imported.emit(report);
        }
    }

    cancel() {
        this.selectedFile.set(null);
        this.dryRun.set(null);
        this.validationError.set(null);
    }

    private async send(dryRun: boolean): Promise<T | undefined> {
        const file = this.selectedFile();
        if (!file) {
            return undefined;
        }

        this.isProcessing.set(true);
        this.validationError.set(null);
        const form = new FormData();
        form.append('file', file);

        const report = await this.run()(form, dryRun);
        if (report && !report.isValidToImport) {
            this.validationError.set({
                message: report.resultMessage || 'An unknown validation error occurred.',
                rows: report.failedRowMessages
            });
        }

        this.isProcessing.set(false);
        return report;
    }
}
