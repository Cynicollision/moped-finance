import { TestBed } from '@angular/core/testing';
import { MoneyComponent, MoneyTone } from './money.component';

describe('MoneyComponent', () => {
    async function render(amount: number, tone: MoneyTone = 'plain', digits?: string) {
        const fixture = TestBed.createComponent(MoneyComponent);
        fixture.componentRef.setInput('amount', amount);
        fixture.componentRef.setInput('tone', tone);
        if (digits) {
            fixture.componentRef.setInput('digits', digits);
        }
        await fixture.whenStable();
        const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
        const colour = span.classList.contains('money-positive') ? 'green' : span.classList.contains('money-negative') ? 'red' : 'plain';
        return { text: span.textContent!.trim(), colour };
    }

    it('APP-6.2 should show money in as "+$" in green, and money out unsigned in the ordinary colour', async () => {
        expect(await render(1250, 'transaction')).toEqual({ text: '+$1,250.00', colour: 'green' });
        expect(await render(-45.12, 'transaction')).toEqual({ text: '$45.12', colour: 'plain' });
    });

    it('APP-6.1 should show a plain amount signed and never red', async () => {
        expect(await render(-3734, 'plain', '1.0-0')).toEqual({ text: '-$3,734', colour: 'plain' });
        expect(await render(2000)).toEqual({ text: '$2,000.00', colour: 'plain' });
    });

    it('APP-6.1 should show a favourable amount green, and red only when it is negative', async () => {
        expect(await render(0, 'favourable')).toEqual({ text: '$0.00', colour: 'green' });
        expect(await render(-20, 'favourable')).toEqual({ text: '-$20.00', colour: 'red' });
    });
});
