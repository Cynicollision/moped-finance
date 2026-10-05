import {
    CUSTOM_ELEMENTS_SCHEMA,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    Injector,
    TemplateRef,
    afterNextRender,
    forwardRef,
    inject,
    input,
    signal,
    viewChild
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { LayoutService } from './../layout/layout.service';

/** What `<emoji-picker>` sends with `emoji-click`: the chosen emoji, in the user's skin tone. */
type EmojiClickEvent = CustomEvent<{ unicode?: string }>;

/** The popover opens below the field, or above it when there isn't room below. */
const popoverPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' }
];

// Loads emoji-picker-element, which defines <emoji-picker>, the first time a picker opens.
let pickerElementLoaded: Promise<unknown> | undefined;

/**
 * A form field for an optional emoji (CAT-1.20), as a form control: its value is one emoji, or '' for none.
 * Opens emoji-picker-element (searchable, grouped, keyboard-accessible, native emoji) in a popover, or in a bottom
 * sheet on phones. The picker reads its emoji data from `emoji/data.json`, which the build copies from
 * emoji-picker-element-data, so the app makes no third-party requests.
 */
@Component({
    selector: 'app-emoji-field',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgTemplateOutlet, OverlayModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EmojiFieldComponent), multi: true }],
    templateUrl: './emoji-field.component.html',
    styleUrl: './emoji-field.component.scss'
})
export class EmojiFieldComponent implements ControlValueAccessor {
    private bottomSheet = inject(MatBottomSheet);
    private layout = inject(LayoutService);
    private injector = inject(Injector);
    private destroyRef = inject(DestroyRef);

    readonly label = input('Icon');

    readonly value = signal('');
    readonly isDisabled = signal(false);
    readonly isPopoverOpen = signal(false);
    readonly popoverPositions = popoverPositions;

    private readonly trigger = viewChild.required<ElementRef<HTMLInputElement>>('trigger');
    private readonly pickerSheet = viewChild.required<TemplateRef<unknown>>('pickerSheet');
    private readonly picker = viewChild<ElementRef<HTMLElement>>('picker');
    private sheetRef?: MatBottomSheetRef;

    private onChange?: (value: string) => void;
    private onTouched?: () => void;

    writeValue(value: string | null): void {
        this.value.set(value ?? '');
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.isDisabled.set(isDisabled);
    }

    async open() {
        if (this.isDisabled() || this.isPopoverOpen() || this.sheetRef) {
            return;
        }

        pickerElementLoaded ??= import('emoji-picker-element');
        await pickerElementLoaded;
        if (this.destroyRef.destroyed) {
            return;
        }

        if (this.layout.isCompact()) {
            // Closing returns focus to the field itself (closed).
            this.sheetRef = this.bottomSheet.open(this.pickerSheet(), {
                ariaLabel: 'Choose an emoji',
                restoreFocus: false
            });
            // The sheet focuses itself once it has slid in, so the search box takes focus after that.
            this.sheetRef.afterOpened().subscribe(() => this.focusSearch());
            this.sheetRef.afterDismissed().subscribe(() => this.closed());
        } else {
            this.isPopoverOpen.set(true);
            afterNextRender(() => this.focusSearch(), { injector: this.injector });
        }
    }

    close() {
        if (this.sheetRef) {
            this.sheetRef.dismiss();
        } else if (this.isPopoverOpen()) {
            this.isPopoverOpen.set(false);
            this.closed();
        }
    }

    pick(event: Event) {
        const emoji = (event as EmojiClickEvent).detail.unicode;
        if (emoji) {
            this.update(emoji);
        }
        this.close();
    }

    clear() {
        this.update('');
        this.trigger().nativeElement.focus();
    }

    onTriggerKeydown(event: KeyboardEvent) {
        // Enter would otherwise submit the form the field is in.
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.open();
        }
    }

    private update(value: string) {
        this.value.set(value);
        this.onChange?.(value);
        this.onTouched?.();
    }

    private closed() {
        this.sheetRef = undefined;
        this.onTouched?.();
        this.trigger().nativeElement.focus();
    }

    /** Starts in the picker's search box, so typing searches straight away. */
    private focusSearch() {
        this.picker()?.nativeElement.shadowRoot?.querySelector<HTMLInputElement>('#search')?.focus();
    }
}
