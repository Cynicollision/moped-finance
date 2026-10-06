import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CsvImportComponent, ImportReport } from './csv-import.component';

interface ThingReport extends ImportReport {
    createdCount: number;
}

const clean: ThingReport = { isValidToImport: true, resultMessage: '', failedRowMessages: [], createdCount: 3 };

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CsvImportComponent],
    template: `
        <app-csv-import
            #importer
            subject="your things"
            columns="Name, Size"
            [run]="run"
            [replaces]="replaces"
            (imported)="imported($event)"
        >
            @if (importer.dryRun(); as results) {
                <p class="summary">Things to create: {{ results.createdCount }}</p>
            }
        </app-csv-import>
    `
})
class HostComponent {
    run = vi.fn<(form: FormData, dryRun: boolean) => Promise<ThingReport | undefined>>();
    replaces = false;
    imported = vi.fn();
}

describe('CsvImportComponent', () => {
    async function render(dryRun: ThingReport | undefined, realRun: ThingReport | undefined = clean, replaces = false) {
        const fixture = TestBed.createComponent(HostComponent);
        const host = fixture.componentInstance;
        host.run.mockImplementation((_form, isDryRun) => Promise.resolve(isDryRun ? dryRun : realRun));
        host.replaces = replaces;
        await fixture.whenStable();

        const element = fixture.nativeElement as HTMLElement;
        const button = (label: string) =>
            Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
                b => b.textContent!.trim() === label
            );
        const click = async (label: string) => {
            button(label)!.click();
            await fixture.whenStable();
        };
        const chooseFile = async () => {
            const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
            Object.defineProperty(input, 'files', { value: [new File(['Name,Size'], 'things.csv')] });
            input.dispatchEvent(new Event('change'));
            await fixture.whenStable();
        };
        return { fixture, host, element, button, click, chooseFile };
    }

    it('TXN-3.8 ACCT-3.8 should say what the file holds and list the columns it needs', async () => {
        const { element } = await render(clean);

        expect(element.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
            'Select a CSV file containing your things. The file must have the following columns: Name, Size.'
        );
    });

    it('TXN-3.3 ACCT-3.3 should validate only once a file is chosen, then show the summary and Begin Import', async () => {
        const { host, element, button, click, chooseFile } = await render(clean);
        expect(button('Validate Import')!.disabled).toBe(true);

        await chooseFile();
        expect(element.querySelector('.file-name')!.textContent).toBe('things.csv');
        await click('Validate Import');

        expect(host.run).toHaveBeenCalledWith(expect.any(FormData), true);
        expect((host.run.mock.calls[0][0] as FormData).get('file')).toBeInstanceOf(File);
        expect(element.querySelector('.dry-run-results h3')!.textContent!.trim()).toBe('Confirm Import');
        expect(element.querySelector('.dry-run-results .summary')!.textContent).toBe('Things to create: 3');
        expect(button('Begin Import')).toBeDefined();
        expect(button('Validate Import')).toBeUndefined();
    });

    it('ACCT-3.3 should mark the confirm panel with a warning for an import that replaces data', async () => {
        const { element, click, chooseFile } = await render(clean, clean, true);
        await chooseFile();

        await click('Validate Import');

        expect(element.querySelector('.dry-run-results h3 mat-icon')!.textContent).toBe('warning');
    });

    it('TXN-3.3 ACCT-3.5 should import on Begin Import and hand the report to the screen', async () => {
        const { host, click, chooseFile } = await render(clean, { ...clean, createdCount: 4 });
        await chooseFile();
        await click('Validate Import');

        await click('Begin Import');

        expect(host.run).toHaveBeenLastCalledWith(expect.any(FormData), false);
        expect(host.imported).toHaveBeenCalledWith({ ...clean, createdCount: 4 });
    });

    it('TXN-3.3 ACCT-3.3 should go back to choosing a file on Cancel', async () => {
        const { host, element, button, click, chooseFile } = await render(clean);
        await chooseFile();
        await click('Validate Import');

        await click('Cancel');

        expect(element.querySelector('.dry-run-results')).toBeNull();
        expect(element.querySelector('.file-name')).toBeNull();
        expect(button('Validate Import')!.disabled).toBe(true);
        expect(host.run).toHaveBeenCalledTimes(1);
    });

    it('TXN-3.7 ACCT-3.7 should list each failed row under the summary, and not offer Begin Import', async () => {
        const { element, button, click, chooseFile } = await render({
            ...clean,
            isValidToImport: false,
            resultMessage: 'Found errors in 2 of 5 rows.',
            failedRowMessages: ["Row 2: Size 'abc' is not a number.", 'Row 3: Name is required.']
        });
        await chooseFile();

        await click('Validate Import');

        expect(element.querySelector('.validation-error strong')!.textContent).toContain('Validation Error:');
        expect(element.querySelector('.validation-error p')!.textContent).toBe('Found errors in 2 of 5 rows.');
        expect(Array.from(element.querySelectorAll('.error-rows li')).map(li => li.textContent)).toEqual([
            "Row 2: Size 'abc' is not a number.",
            'Row 3: Name is required.'
        ]);
        expect(button('Begin Import')).toBeUndefined();
    });

    it('TXN-3.9 ACCT-3.4 should show the refusal and not hand anything to the screen when the real import fails', async () => {
        const { host, element, click, chooseFile } = await render(clean, {
            ...clean,
            isValidToImport: false,
            resultMessage: 'Nothing was imported. Found errors in 1 of 3 rows.',
            failedRowMessages: ['Row 2: Name is required.']
        });
        await chooseFile();
        await click('Validate Import');

        await click('Begin Import');

        expect(element.querySelector('.validation-error p')!.textContent).toBe(
            'Nothing was imported. Found errors in 1 of 3 rows.'
        );
        expect(host.imported).not.toHaveBeenCalled();
    });

    it('APP-2.1 should disable the button and show a spinner while validating', async () => {
        const { fixture, host, element, button, chooseFile } = await render(clean);
        let finish!: (report: ThingReport) => void;
        const pending = new Promise<ThingReport>(resolve => (finish = resolve));
        host.run.mockReturnValueOnce(pending);
        await chooseFile();

        button('Validate Import')!.click();
        fixture.detectChanges();

        expect(button('Validate Import')!.disabled).toBe(true);
        expect(element.querySelector('.button-spinner')).not.toBeNull();
        finish(clean);
        await pending;
        await fixture.whenStable();
        expect(element.querySelector('.button-spinner')).toBeNull();
    });

    it("APP-2.2 should let the user try again when the server can't be reached", async () => {
        const { button, click, chooseFile } = await render(undefined);
        await chooseFile();

        await click('Validate Import');

        expect(button('Validate Import')!.disabled).toBe(false);
    });
});
