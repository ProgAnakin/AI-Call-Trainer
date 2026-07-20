import { describe, expect, it } from 'vitest';
import { computeStreak, localDay } from './useProgress';

function daysAgo(n: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return localDay(d);
}

const TODAY = new Date(2026, 6, 20, 15, 0, 0); // 20/jul/2026, 15h local

describe('localDay', () => {
  it('formats using the local timezone, not UTC', () => {
    // 23:30 local nunca pode virar o dia seguinte
    const lateNight = new Date(2026, 6, 20, 23, 30, 0);
    expect(localDay(lateNight)).toBe('2026-07-20');
  });
});

describe('computeStreak', () => {
  it('returns 0 with no sessions', () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const days = [daysAgo(0, TODAY), daysAgo(1, TODAY), daysAgo(2, TODAY)];
    expect(computeStreak(days, TODAY)).toBe(3);
  });

  it('keeps the streak alive if today has no session yet (counts from yesterday)', () => {
    const days = [daysAgo(1, TODAY), daysAgo(2, TODAY)];
    expect(computeStreak(days, TODAY)).toBe(2);
  });

  it('breaks on a gap', () => {
    const days = [daysAgo(0, TODAY), daysAgo(2, TODAY), daysAgo(3, TODAY)];
    expect(computeStreak(days, TODAY)).toBe(1);
  });

  it('ignores duplicate sessions on the same day', () => {
    const days = [daysAgo(0, TODAY), daysAgo(0, TODAY), daysAgo(1, TODAY)];
    expect(computeStreak(days, TODAY)).toBe(2);
  });

  it('is 0 when the last session was 2+ days ago', () => {
    expect(computeStreak([daysAgo(2, TODAY)], TODAY)).toBe(0);
  });
});
