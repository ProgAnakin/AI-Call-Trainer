import { describe, expect, it } from 'vitest';
import {
  computeAchievements,
  computeGamification,
  levelFromXp,
  totalXp,
  xpOfCall,
  type CallRecord,
} from './gamification';

const call = (over: Partial<CallRecord> = {}): CallRecord => ({
  score: 70,
  meetingBooked: false,
  language: 'pt-BR',
  difficulty: 2,
  objectionAllHandled: false,
  ...over,
});

describe('xpOfCall', () => {
  it('is the raw score with no bonuses on an easy losing call', () => {
    expect(xpOfCall(call({ score: 60 }))).toBe(60);
  });

  it('adds the meeting bonus', () => {
    expect(xpOfCall(call({ score: 60, meetingBooked: true }))).toBe(85);
  });

  it('adds the hard-scenario bonus at difficulty >= 4', () => {
    expect(xpOfCall(call({ score: 60, difficulty: 4 }))).toBe(70);
    expect(xpOfCall(call({ score: 60, difficulty: 5, meetingBooked: true }))).toBe(95);
  });

  it('never goes negative', () => {
    expect(xpOfCall(call({ score: -10 }))).toBe(0);
  });
});

describe('totalXp', () => {
  it('sums xp across calls', () => {
    expect(totalXp([call({ score: 50 }), call({ score: 70, meetingBooked: true })])).toBe(50 + 95);
  });

  it('is zero with no calls', () => {
    expect(totalXp([])).toBe(0);
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 with progress toward level 2', () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.progress).toBe(0);
    expect(l.xpForNext).toBe(200);
  });

  it('crosses into the next level exactly at the threshold', () => {
    expect(levelFromXp(199).level).toBe(1);
    expect(levelFromXp(200).level).toBe(2);
  });

  it('caps at the max level with full progress and no next', () => {
    const l = levelFromXp(999999);
    expect(l.level).toBe(8);
    expect(l.xpForNext).toBeNull();
    expect(l.nextTitleKey).toBeNull();
    expect(l.progress).toBe(1);
  });

  it('reports fractional progress within a level', () => {
    // level 2 spans 200..500 (300 wide); 350 XP is 150 into it → 0.5
    expect(levelFromXp(350).progress).toBeCloseTo(0.5, 5);
  });
});

describe('computeAchievements', () => {
  it('locks everything with no data', () => {
    const a = computeAchievements({ calls: [], streakDays: 0, bestDrillScore: 0 });
    expect(a.every((x) => !x.unlocked)).toBe(true);
    expect(a.find((x) => x.id === 'first_call')?.progress).toBe(0);
  });

  it('unlocks first_call and meeting_1 from one winning call', () => {
    const a = computeAchievements({
      calls: [call({ meetingBooked: true })],
      streakDays: 1,
      bestDrillScore: 0,
    });
    const by = (id: string) => a.find((x) => x.id === id)!;
    expect(by('first_call').unlocked).toBe(true);
    expect(by('meeting_1').unlocked).toBe(true);
    expect(by('meeting_10').unlocked).toBe(false);
  });

  it('unlocks polyglot only with two distinct languages', () => {
    const one = computeAchievements({
      calls: [call({ language: 'pt-BR' }), call({ language: 'pt-BR' })],
      streakDays: 0,
      bestDrillScore: 0,
    });
    expect(one.find((x) => x.id === 'polyglot')?.unlocked).toBe(false);
    const two = computeAchievements({
      calls: [call({ language: 'pt-BR' }), call({ language: 'en-US' })],
      streakDays: 0,
      bestDrillScore: 0,
    });
    expect(two.find((x) => x.id === 'polyglot')?.unlocked).toBe(true);
  });

  it('unlocks tough_closer only for a booked hard scenario', () => {
    const a = computeAchievements({
      calls: [call({ meetingBooked: true, difficulty: 5 })],
      streakDays: 0,
      bestDrillScore: 0,
    });
    expect(a.find((x) => x.id === 'tough_closer')?.unlocked).toBe(true);
  });

  it('clamps displayed current to the goal', () => {
    const a = computeAchievements({
      calls: Array.from({ length: 40 }, () => call()),
      streakDays: 0,
      bestDrillScore: 0,
    });
    const vol = a.find((x) => x.id === 'volume_25')!;
    expect(vol.current).toBe(25);
    expect(vol.progress).toBe(1);
  });
});

describe('computeGamification', () => {
  it('assembles xp, level and achievement count', () => {
    const g = computeGamification({
      calls: [call({ score: 90, meetingBooked: true }), call({ score: 80 })],
      streakDays: 3,
      bestDrillScore: 8,
    });
    expect(g.xp).toBe(115 + 80);
    expect(g.level.level).toBe(1);
    expect(g.unlockedCount).toBeGreaterThan(0);
    expect(g.achievements).toHaveLength(13);
  });
});
