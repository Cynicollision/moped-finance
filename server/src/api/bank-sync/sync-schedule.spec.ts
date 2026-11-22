import { CATCH_UP_DELAY_MS, ScheduleState, SyncSchedule } from './sync-schedule';

// The tests run in New York (jest.config.js), so these are New York's wall-clock times.
const at = (day: number, hours: number, minutes: number, month = 11) => new Date(2026, month - 1, day, hours, minutes);
const minute = 60_000;
// 5:17, 11:17, 17:17 and 23:17.
const scheduleMinute = 5 * 60 + 17;

describe('SyncSchedule', () => {
    function plan(changes: Partial<ScheduleState>) {
        return SyncSchedule.plan({
            now: at(22, 12, 0),
            scheduleMinute,
            connectedAt: at(1, 9, 0),
            lastScheduledAt: at(22, 11, 17),
            handledSlot: null,
            ...changes
        });
    }

    it('SYNC-3.1 should plan the four daily slots, 6 hours apart, at the minute chosen', () => {
        const slots = [SyncSchedule.nextSlot(at(22, 0, 0), scheduleMinute)];
        for (let i = 0; i < 4; i++) {
            slots.push(SyncSchedule.nextSlot(slots[slots.length - 1], scheduleMinute));
        }

        expect(slots).toEqual([at(22, 5, 17), at(22, 11, 17), at(22, 17, 17), at(22, 23, 17), at(23, 5, 17)]);
    });

    it('SYNC-3.1 should put the first slot in the first 6 hours of the day', () => {
        expect(SyncSchedule.nextSlot(at(22, 0, 0), 0)).toEqual(at(22, 6, 0));
        expect(SyncSchedule.nextSlot(at(21, 23, 59), 0)).toEqual(at(22, 0, 0));
        expect(SyncSchedule.nextSlot(at(22, 0, 0), 359)).toEqual(at(22, 5, 59));
        expect(SyncSchedule.latestSlot(at(22, 5, 58), 359)).toEqual(at(21, 23, 59));
    });

    it('SYNC-3.1 should keep the wall-clock times on a day the clocks change', () => {
        // The clocks went back an hour at 2:00 on November 1, 2026: 5:17 is still 5:17, though 6 hours 17 minutes in.
        const fallBack = SyncSchedule.nextSlot(at(1, 0, 0), scheduleMinute);
        expect(fallBack).toEqual(at(1, 5, 17));
        expect(fallBack.getTime() - at(1, 0, 0).getTime()).toBe((6 * 60 + 17) * minute);
        expect(SyncSchedule.nextSlot(fallBack, scheduleMinute)).toEqual(at(1, 11, 17));

        // They went forward at 2:00 on March 8, 2026, so 2:17 didn't happen that day: its slot is at 3:17.
        const springForward = SyncSchedule.nextSlot(at(8, 0, 0, 3), 2 * 60 + 17);
        expect([springForward.getHours(), springForward.getMinutes()]).toEqual([3, 17]);
        expect(SyncSchedule.nextSlot(springForward, 2 * 60 + 17)).toEqual(at(8, 8, 17, 3));
    });

    it('SYNC-3.1 should wait for the next slot after one that ran', () => {
        expect(plan({})).toEqual({ at: at(22, 17, 17), slot: at(22, 17, 17) });
    });

    it('SYNC-3.2 should catch up a slot missed while the server was down, a couple of minutes after starting', () => {
        // Down from before 11:17 until 12:00.
        const planned = plan({ lastScheduledAt: at(22, 5, 17) });

        expect(planned).toEqual({ at: new Date(at(22, 12, 0).getTime() + CATCH_UP_DELAY_MS), slot: at(22, 11, 17) });
    });

    it('SYNC-3.2 should catch up once for several missed slots', () => {
        // Down for a day and a half: only the latest missed slot runs.
        const planned = plan({ now: at(23, 12, 0), lastScheduledAt: at(21, 23, 17) });

        expect(planned).toEqual({ at: new Date(at(23, 12, 0).getTime() + CATCH_UP_DELAY_MS), slot: at(23, 11, 17) });
    });

    it('SYNC-3.2 should catch up even when no scheduled sync has run since connecting', () => {
        expect(plan({ lastScheduledAt: null }).slot).toEqual(at(22, 11, 17));
    });

    it('SYNC-3.2 should leave the catch-up to the next slot when it comes first', () => {
        expect(plan({ now: at(22, 17, 16), lastScheduledAt: at(22, 5, 17) })).toEqual({
            at: at(22, 17, 17),
            slot: at(22, 17, 17)
        });
    });

    it('SYNC-3.2 should never run a slot twice across a restart', () => {
        // The 11:17 sync ran (or was skipped at the limit) a moment after its time, then the server restarted.
        expect(plan({ now: at(22, 11, 20), lastScheduledAt: at(22, 11, 17) })).toEqual({
            at: at(22, 17, 17),
            slot: at(22, 17, 17)
        });
        // Its catch-up ran, then the server restarted again.
        expect(plan({ now: at(22, 12, 5), lastScheduledAt: at(22, 12, 2) }).slot).toEqual(at(22, 17, 17));
    });

    it('SYNC-3.2 should not catch up a slot from before connecting', () => {
        expect(plan({ connectedAt: at(22, 11, 30), lastScheduledAt: null }).slot).toEqual(at(22, 17, 17));
    });

    it('SYNC-3.2 should not catch up a slot this server dealt with without syncing', () => {
        // Automatic sync was off at 11:17, so no run was recorded.
        expect(plan({ lastScheduledAt: at(22, 5, 17), handledSlot: at(22, 11, 17) }).slot).toEqual(at(22, 17, 17));
    });

    it('SYNC-3.2 should not plan a slot again when its timer fired a moment early', () => {
        const planned = plan({ now: at(22, 17, 16), handledSlot: at(22, 17, 17) });

        expect(planned.slot).toEqual(at(22, 23, 17));
    });
});
