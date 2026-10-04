import { DateTimeUtil } from '@server/utility';

// A test that fixes the time with DateTimeUtil.setClock can't leave it fixed for the next one.
afterEach(() => {
    DateTimeUtil.resetClock();
});
