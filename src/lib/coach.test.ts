import { describe, expect, it } from 'vitest';
import { actionView, nextBestAction, skillLevel, type CoachInput } from './coach';

const base: CoachInput = {
  totalSessions: 5,
  weakestCriterion: { key: 'descoberta', avg: 6 },
  meetingRate: 0.5,
  outcomeCount: 5,
};

describe('nextBestAction', () => {
  it('sends a first-timer to their first call', () => {
    expect(nextBestAction({ ...base, totalSessions: 0 }).kind).toBe('first_call');
  });

  it('routes a weak objection score to the gauntlet', () => {
    const a = nextBestAction({ ...base, weakestCriterion: { key: 'tratamento_objecoes', avg: 3 } });
    expect(a.kind).toBe('drill_objections');
  });

  it('focuses a non-objection weak criterion', () => {
    const a = nextBestAction({ ...base, weakestCriterion: { key: 'descoberta', avg: 3 } });
    expect(a).toEqual({ kind: 'focus_criterion', criterionKey: 'descoberta', avg: 3 });
  });

  it('pushes to close when fundamentals are ok but meetings are low', () => {
    const a = nextBestAction({
      ...base,
      weakestCriterion: { key: 'descoberta', avg: 7 },
      meetingRate: 0.1,
      outcomeCount: 4,
    });
    expect(a.kind).toBe('book_meeting');
  });

  it('does not trust a low meeting rate on a tiny sample', () => {
    const a = nextBestAction({
      ...base,
      weakestCriterion: { key: 'descoberta', avg: 7 },
      meetingRate: 0,
      outcomeCount: 1,
    });
    expect(a.kind).toBe('focus_criterion');
  });

  it('keeps going when everything is solid', () => {
    expect(nextBestAction({ ...base, weakestCriterion: null }).kind).toBe('keep_going');
  });
});

describe('actionView', () => {
  it('maps every action to a route + i18n keys', () => {
    for (const kind of ['first_call', 'drill_objections', 'book_meeting', 'keep_going'] as const) {
      const v = actionView({ kind });
      expect(v.route).toBeTruthy();
      expect(v.titleKey).toContain('coach.');
    }
    expect(actionView({ kind: 'drill_objections' }).route).toBe('/drill');
  });
});

describe('skillLevel', () => {
  it('bands averages into competency levels', () => {
    expect(skillLevel(2)).toBe('novice');
    expect(skillLevel(4)).toBe('developing');
    expect(skillLevel(6)).toBe('proficient');
    expect(skillLevel(8)).toBe('advanced');
    expect(skillLevel(7.5)).toBe('advanced');
  });
});
