import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';

/** The made-up banks of the fake Bridge. The first four accounts mirror the seed data's, so they can be linked. */
export interface FakeConnection {
    id: string;
    name: string;
    orgId: string;
    orgUrl: string;
}

export interface FakeAccount {
    id: string;
    connectionId: string;
    name: string;
    currency: string;
    openingCents: number;
    /** Only in some scenarios, and only after the first sync (`fake:new-account`). */
    appearsLater?: boolean;
}

export const fakeConnections: FakeConnection[] = [
    { id: 'CON-HARBOR', name: 'Harbor Community Bank', orgId: 'harbor.example', orgUrl: 'https://harbor.example' },
    { id: 'CON-SUMMIT', name: 'Summit Credit Union', orgId: 'summit.example', orgUrl: 'https://summit.example' },
    { id: 'CON-LAKESIDE', name: 'Lakeside Home Loans', orgId: 'lakeside.example', orgUrl: 'https://lakeside.example' },
    { id: 'CON-MAPLE', name: 'Maple Leaf Trust', orgId: 'mapleleaf.example', orgUrl: 'https://mapleleaf.example' }
];

export const fakeAccountIds = {
    checking: 'ACT-HARBOR-CHECKING',
    savings: 'ACT-HARBOR-SAVINGS',
    holidayFund: 'ACT-HARBOR-HOLIDAY',
    visa: 'ACT-SUMMIT-VISA',
    certificate: 'ACT-SUMMIT-CERTIFICATE',
    mortgage: 'ACT-LAKESIDE-MORTGAGE',
    chequing: 'ACT-MAPLE-CHEQUING'
} as const;

const ids = fakeAccountIds;

export const fakeAccounts: FakeAccount[] = [
    { id: ids.checking, connectionId: 'CON-HARBOR', name: 'Everyday Checking', currency: 'USD', openingCents: 420_000 },
    {
        id: ids.savings,
        connectionId: 'CON-HARBOR',
        name: 'High-Yield Savings',
        currency: 'USD',
        openingCents: 1_500_000
    },
    // Not in the seed data, for Create new account (SYNC-2.3).
    { id: ids.holidayFund, connectionId: 'CON-HARBOR', name: 'Holiday Fund', currency: 'USD', openingCents: 60_000 },
    { id: ids.visa, connectionId: 'CON-SUMMIT', name: 'Rewards Visa', currency: 'USD', openingCents: -90_000 },
    {
        id: ids.certificate,
        connectionId: 'CON-SUMMIT',
        name: 'Share Certificate',
        currency: 'USD',
        openingCents: 1_000_000,
        appearsLater: true
    },
    { id: ids.mortgage, connectionId: 'CON-LAKESIDE', name: 'Mortgage', currency: 'USD', openingCents: -28_750_000 },
    // Can't be linked (SYNC-2.6).
    { id: ids.chequing, connectionId: 'CON-MAPLE', name: 'Chequing', currency: 'CAD', openingCents: 150_000 }
];

/** Transactions start here, so a day's balance always agrees with the transactions before it. */
export const fakeOriginDate: CalendarDate = '2025-01-01';

/** One bank transaction, as it is once posted, plus how it behaves while pending and when the bank corrects it. */
export interface FakeTransaction {
    accountId: string;
    id: string;
    /** The day it happened. Only card purchases say so (`transacted_at`); the rest have only a posted date. */
    transactedOn: CalendarDate;
    hasTransactedAt: boolean;
    /** Seconds after local midnight, for the timestamps. */
    timeOfDay: number;
    /** When it posts normally, and in `fake:pending`, where card purchases take 1 to 3 days. */
    postsOn: CalendarDate;
    postsOnSlowly: CalendarDate;
    amountCents: number;
    payee: string;
    description: string;
    /** `fake:pending`: what it shows while pending, when that differs. */
    pending?: { id?: string; amountCents?: number };
    /** `fake:pending`: a hold that shows while pending and never posts. */
    vanishes?: boolean;
    /** `fake:corrections`: what the bank changes it to 2 days after it posts (SYNC-4.4). */
    correction?: { amountCents: number; description: string; transactedOn: CalendarDate };
}

/** A small seeded generator (mulberry32), so the same key always gives the same numbers. */
export class FakeRandom {
    private state: number;

    constructor(key: string) {
        // FNV-1a
        let hash = 2166136261;
        for (let i = 0; i < key.length; i++) {
            hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
        }
        this.state = hash >>> 0;
    }

    /** From 0 (included) to 1 (excluded). */
    public next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    public chance(probability: number): boolean {
        return this.next() < probability;
    }

    /** Whole cents from `min` to `max` dollars. */
    public cents(min: number, max: number): number {
        return Math.round((min + this.next() * (max - min)) * 100);
    }

    public pick<T>(items: readonly T[]): T {
        return items[Math.floor(this.next() * items.length)];
    }

    public int(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }
}

interface Merchant {
    payee: string;
    statement: string;
    min: number;
    max: number;
}

const coffee: Merchant = { payee: 'Daily Grind Coffee', statement: 'DAILY GRIND COFFEE #12', min: 3.5, max: 6.75 };
const groceries: Merchant[] = [
    { payee: 'FreshMart', statement: 'FRESHMART #0412', min: 25, max: 140 },
    { payee: 'Green Basket Market', statement: 'GREEN BASKET MKT', min: 20, max: 90 }
];
const fuel: Merchant[] = [
    { payee: 'QuickFuel', statement: 'QUICKFUEL 2291', min: 30, max: 62 },
    { payee: 'Corner Gas', statement: 'CORNER GAS 118', min: 28, max: 58 }
];
/** Their pending amount is before the tip. */
const restaurants: Merchant[] = [
    { payee: 'Sakura Sushi', statement: 'SAKURA SUSHI', min: 18, max: 70 },
    { payee: 'Burger Barn', statement: 'BURGER BARN 07', min: 12, max: 35 },
    { payee: "Luigi's Trattoria", statement: 'LUIGIS TRATTORIA', min: 30, max: 90 },
    { payee: 'The Noodle Bar', statement: 'THE NOODLE BAR', min: 14, max: 40 },
    { payee: 'Taco Loco', statement: 'TACO LOCO #3', min: 10, max: 30 }
];
const shops: Merchant[] = [
    { payee: 'Everything Store', statement: 'EVERYTHINGSTORE*MKTP', min: 12, max: 120 },
    { payee: 'Bookworm Books', statement: 'BOOKWORM BOOKS', min: 10, max: 45 },
    { payee: 'Corner Hardware', statement: 'CORNER HARDWARE', min: 8, max: 95 }
];
const subscriptions: { day: number; payee: string; statement: string; cents: number }[] = [
    { day: 3, payee: 'Peak Fitness', statement: 'PEAK FITNESS MEMBERSHIP', cents: 4500 },
    { day: 9, payee: 'StreamFlix', statement: 'STREAMFLIX.COM', cents: 1549 },
    { day: 14, payee: 'TuneBox', statement: 'TUNEBOX MUSIC', cents: 1099 },
    { day: 20, payee: 'CloudDrive', statement: 'CLOUDDRIVE STORAGE', cents: 299 }
];

const hour = 3600;

/**
 * Every transaction of every fake account that happened from the origin to `today`, the same each time for the same
 * day. Card purchases happen during the day and post the next morning (or, in `fake:pending`, 1 to 3 days later);
 * everything else posts early in the morning of its day.
 */
export function generateFakeTransactions(today: CalendarDate): FakeTransaction[] {
    const transactions: FakeTransaction[] = [];
    let dayIndex = 0;
    for (let date = fakeOriginDate; date <= today; date = CalendarDateUtil.addDays(date, 1), dayIndex++) {
        transactions.push(...transactionsOn(date, dayIndex));
    }
    return transactions;
}

function transactionsOn(date: CalendarDate, dayIndex: number): FakeTransaction[] {
    const day = Number(date.slice(8));
    const month = date.slice(0, 7);
    const out: FakeTransaction[] = [];
    const counters = new Map<string, number>();

    const add = (
        accountId: string,
        payee: string,
        description: string,
        amountCents: number,
        extra: Partial<FakeTransaction> = {}
    ) => {
        const n = (counters.get(accountId) ?? 0) + 1;
        counters.set(accountId, n);
        out.push({
            accountId,
            id: `TRN-${accountId.slice(4)}-${date.replace(/-/g, '')}-${n}`,
            transactedOn: date,
            hasTransactedAt: false,
            timeOfDay: 5 * hour + n * 60,
            postsOn: date,
            postsOnSlowly: date,
            amountCents,
            payee,
            description,
            ...extra
        });
    };

    // A card purchase, with how it behaves pending and corrected.
    const purchase = (random: FakeRandom, merchant: Merchant, options: { tip?: boolean } = {}) => {
        const beforeTip = -random.cents(merchant.min, merchant.max);
        const amountCents = options.tip ? Math.round(beforeTip * 1.2) : beforeTip;
        const n = (counters.get(ids.visa) ?? 0) + 1;
        const bucket = random.int(0, 9);
        const extra: Partial<FakeTransaction> = {
            hasTransactedAt: true,
            timeOfDay: random.int(8 * hour, 21 * hour),
            postsOn: CalendarDateUtil.addDays(date, 1),
            postsOnSlowly: CalendarDateUtil.addDays(date, random.int(1, 3))
        };
        if (options.tip || bucket === 0) {
            // Pending under its own ID, posted under another.
            extra.pending = { id: `PND-SUMMIT-VISA-${date.replace(/-/g, '')}-${n}` };
        }
        if (options.tip) {
            extra.pending = { ...extra.pending, amountCents: beforeTip };
        }
        if (bucket === 1) {
            extra.correction = {
                amountCents: amountCents - 200,
                description: `${merchant.statement} ADJ`,
                transactedOn: CalendarDateUtil.addDays(date, -1)
            };
        }
        add(ids.visa, merchant.payee, merchant.statement, amountCents, extra);
    };

    const random = new FakeRandom(`fake|${date}`);

    // Everyday Checking
    if ((dayIndex - 2) % 14 === 0) {
        add(ids.checking, 'Acme Robotics', 'ACME ROBOTICS DIR DEP PPD', 240_000);
    }
    if (day === 1) {
        add(ids.checking, 'Lakeside Home Loans', 'LAKESIDE HOME LN PMT', -185_000);
        add(ids.checking, 'Transfer to Holiday Fund', 'ONLINE TRANSFER TO SAV ...7710', -7_500);
        add(ids.holidayFund, 'Transfer from Checking', 'ONLINE TRANSFER FROM CHK ...9023', 7_500);
        add(ids.mortgage, 'Payment', 'PAYMENT RECEIVED - THANK YOU', 185_000);
        add(ids.mortgage, 'Lakeside Home Loans', 'INTEREST CHARGED', -random.cents(1280, 1310));
        add(ids.chequing, 'Northern Lights Studio', 'PAYROLL DEPOSIT', 120_000);
    }
    if (day === 5) {
        add(ids.checking, 'City Power & Light', 'CITY PWR&LT AUTOPAY', -random.cents(85, 160));
    }
    if (day === 12) {
        add(ids.checking, 'Bluewave Internet', 'BLUEWAVE INTERNET', -6_999);
    }
    if (day === 15) {
        add(ids.checking, 'Transfer to Savings', 'ONLINE TRANSFER TO SAV ...4471', -50_000);
        add(ids.savings, 'Transfer from Checking', 'ONLINE TRANSFER FROM CHK ...9023', 50_000);
    }
    if (day === 18) {
        add(ids.checking, 'Nimbus Mobile', 'NIMBUS MOBILE AUTOPAY', -4_500);
    }
    if (day === 22) {
        add(ids.checking, 'Metro Water', 'METRO WATER UTIL', -random.cents(30, 60));
    }
    if (day === 25) {
        const payment = new FakeRandom(`card-payment|${month}`).cents(1100, 1500);
        add(ids.checking, 'Summit Visa Payment', 'SUMMIT CU CARD PMT', -payment);
    }
    if (day === 26) {
        const payment = new FakeRandom(`card-payment|${month}`).cents(1100, 1500);
        add(ids.visa, 'Payment - Thank You', 'PAYMENT - THANK YOU', payment);
    }
    if (day === 28) {
        add(ids.savings, 'Harbor Community Bank', 'INTEREST PAYMENT', random.cents(35, 55));
        add(ids.certificate, 'Summit Credit Union', 'DIVIDEND', random.cents(18, 24));
    }

    // Rewards Visa
    for (const subscription of subscriptions.filter(s => s.day === day)) {
        add(ids.visa, subscription.payee, subscription.statement, -subscription.cents, {
            postsOn: CalendarDateUtil.addDays(date, 1),
            postsOnSlowly: CalendarDateUtil.addDays(date, 1),
            hasTransactedAt: true
        });
    }
    if (random.chance(0.55)) {
        purchase(random, coffee);
    }
    if (random.chance(0.3)) {
        purchase(random, random.pick(groceries));
    }
    if (random.chance(0.18)) {
        const station = random.pick(fuel);
        // At the pump, a $1 hold that vanishes, then the real amount under its own ID.
        add(ids.visa, station.payee, `${station.statement} PRE-AUTH`, -100, {
            hasTransactedAt: true,
            timeOfDay: 7 * hour,
            postsOn: CalendarDateUtil.addDays(date, 2),
            postsOnSlowly: CalendarDateUtil.addDays(date, 2),
            vanishes: true
        });
        purchase(random, station);
    }
    if (random.chance(0.18)) {
        purchase(random, random.pick(restaurants), { tip: true });
    }
    if (random.chance(0.08)) {
        purchase(random, random.pick(shops));
    }

    // Chequing (CAD)
    if ((dayIndex - 2) % 7 === 0) {
        add(ids.chequing, 'Maple Market', 'MAPLE MARKET #22', -random.cents(40, 110));
    }

    return out;
}
