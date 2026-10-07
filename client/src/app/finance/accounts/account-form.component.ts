import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    OnChanges,
    SimpleChanges,
    computed,
    input,
    output
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountType } from '@shared/finance/enum';
import { Account, AccountFields, Institution } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';

@Component({
    selector: 'app-account-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './account-form.component.html',
    styleUrl: './account-form.component.scss'
})
export class AccountFormComponent implements OnInit, OnChanges {
    readonly account = input<Account | null>(null);
    readonly mode = input<'create' | 'edit'>('create');
    /** The institutions to choose from, sorted by name. */
    readonly institutions = input<Institution[]>([]);
    /** The institution a new account starts at, when it's added from that institution. */
    readonly defaultInstitutionId = input<string | null>(null);
    /** While the parent saves: Save is disabled and shows a spinner. */
    readonly saving = input(false);
    readonly save = output<AccountFields>();
    readonly cancelled = output<void>();

    /** The Type select's options, under their groups (ACCT-1.2). */
    readonly typeGroups = AccountTypeUtil.groups;

    readonly accountForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        institutionId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        type: new FormControl<AccountType>(AccountType.Checking, {
            nonNullable: true,
            validators: [Validators.required]
        }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        hideFromSpending: new FormControl<boolean>(false, { nonNullable: true })
    });

    private readonly type = toSignal(this.accountForm.controls.type.valueChanges, {
        initialValue: this.accountForm.controls.type.value
    });

    /** The group and Asset/Liability that the chosen type decides, shown read-only under it (ACCT-1.2). */
    readonly typeHint = computed(() => {
        const type = this.type();
        return `${AccountTypeUtil.groupOf(type)} · ${AccountTypeUtil.categoryOf(type)}`;
    });

    ngOnInit() {
        this.updateFormState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['account'] || changes['defaultInstitutionId']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        const account = this.account();
        if (account) {
            this.accountForm.patchValue({
                name: account.name,
                institutionId: account.institutionId,
                type: account.type,
                isHidden: account.isHidden,
                hideFromSpending: account.hideFromSpending
            });
        } else {
            this.accountForm.controls.institutionId.setValue(this.defaultInstitutionId() ?? '');
        }
    }

    hasUnsavedChanges(): boolean {
        return this.accountForm.dirty;
    }

    onSubmit() {
        if (this.accountForm.valid) {
            this.save.emit(this.accountForm.getRawValue());
        }
    }

    onCancelClick() {
        this.cancelled.emit();
    }
}
