import { describe, expect, it } from 'vitest';
import { advanceSchedule } from '../src/lib/procurement-rules';

describe('advanceSchedule with long downtime', () => {
  it('skips decades of missed weekly periods without iterating every week', () => {
    expect(advanceSchedule(new Date('1970-01-01T00:00:00.000Z'), 'WEEKLY', new Date('2026-11-13T00:00:00.000Z')).toISOString()).toBe('2026-11-19T00:00:00.000Z');
  });
  it('preserves the next weekly occurrence when already in the future', () => {
    expect(advanceSchedule(new Date('2026-11-13T00:00:00.000Z'), 'WEEKLY', new Date('2026-11-01T00:00:00.000Z')).toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });
});
