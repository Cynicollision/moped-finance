import { BANK_SYNC_DAILY_REQUEST_LIMIT } from '@shared/finance/contracts';
import { BankSyncQuota } from '@shared/finance/types';
import { DateTimeUtil } from '@server/utility';
import { ISimplefinData } from './simplefin-data';

const windowMs = 24 * 60 * 60_000;

/**
 * SYNC-3.4's limit: at most 20 requests to Bridge in any 24 hours, whatever started them. Every run that asked Bridge
 * counts, failed ones too, from the moment just before its request went out.
 */
export class SyncQuota {
    constructor(
        private readonly data: Pick<ISimplefinData, 'requestTimesSince'>,
        public readonly limit = BANK_SYNC_DAILY_REQUEST_LIMIT
    ) {}

    public async check(): Promise<BankSyncQuota> {
        const now = DateTimeUtil.now();
        const times = await this.data.requestTimesSince(DateTimeUtil.addMilliseconds(now, -windowMs));
        const remaining = Math.max(0, this.limit - times.length);

        // Full: the next request frees up when the oldest of the latest `limit` leaves the 24 hours.
        const availableAt =
            remaining > 0 ? null : DateTimeUtil.addMilliseconds(times[times.length - this.limit], windowMs);

        return { limit: this.limit, remaining, availableAt };
    }
}
