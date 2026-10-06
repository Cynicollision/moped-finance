import { CsvValue } from './csv-value';

describe('CsvValue', () => {
    describe('date', () => {
        it.each([
            ['2026-05-17', '2026-05-17'],
            ['2026-05-17T23:59:59.000Z', '2026-05-17'],
            ['2026-05-17T00:00:00-04:00', '2026-05-17'],
            ['5/17/2026', '2026-05-17'],
            ['05/07/2026', '2026-05-07'],
            ['2/29/2024', '2024-02-29']
        ])('TXN-3.10 should read %p as %p', (text, expected) => {
            expect(CsvValue.date('Date', text)).toEqual({ success: true, value: expected });
        });

        it.each(['2/29/2026', '2026-04-31', '0/1/2026', '2026-00-10', '17/05/2026'])(
            'TXN-3.10 should reject the impossible date %p',
            text => {
                expect(CsvValue.date('Date', text)).toEqual({
                    success: false,
                    message: `Date '${text}' is not a valid date.`
                });
            }
        );

        it.each(['May 17, 2026', '2026/05/17', '17.05.2026', '5/17/26'])(
            'TXN-3.10 should reject the unsupported format %p',
            text => {
                expect(CsvValue.date('Date', text).success).toBe(false);
            }
        );
    });

    describe('amount', () => {
        it.each([
            ['0', 0],
            ['-12.5', -12.5],
            ['+7', 7],
            ['$1,234.56', 1234.56],
            ['-$1,234', -1234],
            ['9999999999.99', 9999999999.99],
            ['-9999999999.99', -9999999999.99]
        ])('TXN-3.10 should read %p as %p', (text, expected) => {
            expect(CsvValue.amount('Amount', text)).toEqual({ success: true, value: expected });
        });

        it.each(['1,23', '12,3456', '1.', '.5', '1e5', 'abc', '$-5', '(12.00)'])(
            'TXN-3.10 should reject %p as not a number',
            text => {
                expect(CsvValue.amount('Amount', text)).toEqual({
                    success: false,
                    message: `Amount '${text}' is not a number.`
                });
            }
        );

        it('TXN-3.10 should reject more than two decimal places', () => {
            expect(CsvValue.amount('Amount', '1.005').success).toBe(false);
        });

        it('TXN-3.10 should reject a value too large for DECIMAL(12, 2)', () => {
            expect(CsvValue.amount('Amount', '10000000000.00')).toEqual({
                success: false,
                message: "Amount '10000000000.00' is too large."
            });
        });
    });

    describe('boolean', () => {
        it.each([
            ['true', true],
            ['TRUE', true],
            ['false', false],
            ['False', false],
            ['', false]
        ])('TXN-3.10 should read %p as %p', (text, expected) => {
            expect(CsvValue.boolean('IsHidden', text)).toEqual({ success: true, value: expected });
        });

        it('CAT-7.5 should read blank as the given default', () => {
            expect(CsvValue.boolean('IsActive', '', true)).toEqual({ success: true, value: true });
            expect(CsvValue.boolean('IsActive', 'false', true)).toEqual({ success: true, value: false });
        });

        it.each(['yes', '1', 'x'])('TXN-3.10 should reject %p', text => {
            expect(CsvValue.boolean('IsHidden', text).success).toBe(false);
        });
    });
});
