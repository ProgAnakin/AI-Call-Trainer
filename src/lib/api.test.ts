import { describe, expect, it } from 'vitest';
import { lowerFirst } from './api';

describe('lowerFirst', () => {
  it('lowercases the first letter so the line flows after "But/Mas/Però"', () => {
    expect(lowerFirst('Reps forget follow-ups')).toBe('reps forget follow-ups');
    expect(lowerFirst('A gente já usa HubSpot')).toBe('a gente já usa HubSpot');
    expect(lowerFirst('Funziona così da 40 anni')).toBe('funziona così da 40 anni');
  });

  it('preserves the English "I", which is always capitalised', () => {
    expect(lowerFirst('I have seen this promise before.')).toBe('I have seen this promise before.');
    expect(lowerFirst("I'm not sure it is a priority.")).toBe("I'm not sure it is a priority.");
    expect(lowerFirst('I, for one, disagree.')).toBe('I, for one, disagree.');
  });

  it('still lowercases words that merely start with I', () => {
    expect(lowerFirst('Integrations break every update')).toBe('integrations break every update');
    expect(lowerFirst('It has always worked this way')).toBe('it has always worked this way');
  });

  it('tolerates an empty string', () => {
    expect(lowerFirst('')).toBe('');
  });
});
