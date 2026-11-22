import { CalendarDateUtil } from '@shared/core/util';
import { DateTimeUtil } from '@server/utility';

/** The four daily syncs are this many minutes apart (SYNC-3.1). */
const slotMinutes = 6 * 60;
const slotsPerDay = 4;

/** How long after the server starts a sync it missed while down runs (SYNC-3.2). */
export const CATCH_UP_DELAY_MS = 2 * 60_000;

/** When the scheduler next syncs, and the slot that sync is for. */
export interface PlannedSync {
    at: Date;
    slot: Date;
}

/** What the next sync is worked out from. */
export interface ScheduleState {
    now: Date;
    /** The minute of the day of the first slot, 0 to 359 (SYNC-3.1). */
    scheduleMinute: number;
    /** When the current setup token was claimed: slots before it are nobody's to catch up. */
    connectedAt: Date;
    /** When the latest scheduled run started, skipped ones included, whichever server ran it. */
    lastScheduledAt: Date | null;
    /** The latest slot this server has dealt with, whether it synced or not (Automatic sync off). */
    handledSlot: Date | null;
}

/**
 * The schedule's slots (SYNC-3.1): `scheduleMinute` and every 6 hours after it, by the wall clock in the server's time
 * zone, from yesterday to tomorrow, in order.
 */
function slotsAround(now: Date, scheduleMinute: number): Date[] {
    const today = CalendarDateUtil.fromDate(now);
    const slots: Date[] = [];
    for (const offset of [-1, 0, 1]) {
        const day = CalendarDateUtil.addDays(today, offset);
        for (let index = 0; index < slotsPerDay; index++) {
            slots.push(DateTimeUtil.atMinuteOfDay(day, scheduleMinute + index * slotMinutes));
        }
    }
    return slots;
}

export const SyncSchedule = {
    /** The latest slot at or before `now`. */
    latestSlot(now: Date, scheduleMinute: number): Date {
        const passed = slotsAround(now, scheduleMinute).filter(slot => slot <= now);
        return passed[passed.length - 1];
    },

    /** The first slot after `after`. */
    nextSlot(after: Date, scheduleMinute: number): Date {
        return slotsAround(after, scheduleMinute).find(slot => slot > after)!;
    },

    /**
     * The next sync (SYNC-3.2). Normally the next slot. When the latest slot passed with no scheduled run since it, while
     * the server was down, it's a catch-up a couple of minutes from now, unless the next slot comes first. A slot that
     * has had its run, here or before a restart, is never run again.
     */
    plan(state: ScheduleState): PlannedSync {
        const { now, scheduleMinute } = state;
        const latest = SyncSchedule.latestSlot(now, scheduleMinute);
        const missed =
            latest > state.connectedAt &&
            (!state.lastScheduledAt || state.lastScheduledAt < latest) &&
            (!state.handledSlot || state.handledSlot < latest);

        // A slot already dealt with is never planned again, even if the clock reads a little before it.
        const after = state.handledSlot && state.handledSlot > now ? state.handledSlot : now;
        const next = SyncSchedule.nextSlot(after, scheduleMinute);
        if (missed) {
            const catchUp = DateTimeUtil.addMilliseconds(now, CATCH_UP_DELAY_MS);
            if (catchUp < next) {
                return { at: catchUp, slot: latest };
            }
        }
        return { at: next, slot: next };
    }
};
