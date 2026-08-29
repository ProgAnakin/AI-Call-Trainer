import { describe, expect, it } from 'vitest';
import { demoLinesFor, lowerFirst } from './api';

describe('demoLinesFor', () => {
  it('gives pt-PT its own lexicon, not the Brazilian one', () => {
    const br = demoLinesFor('pt-BR');
    const pt = demoLinesFor('pt-PT');
    expect(pt).not.toBe(br);
    // European Portuguese uses the "estar a + infinitive" construction.
    expect(pt.pressed).toMatch(/está a fazer-me perder tempo/i);
    expect(br.pressed).toMatch(/tomando meu tempo/i);
  });

  it('maps the other languages to their own sets', () => {
    expect(demoLinesFor('it-IT').generic).toMatch(/perché/i);
    expect(demoLinesFor('en-US').generic).toMatch(/why should I care/i);
    expect(demoLinesFor('pt-BR').generic).toMatch(/por que/i);
  });

  it('keeps the intro personalised per language', () => {
    expect(demoLinesFor('pt-PT').intro('Ricardo')).toContain('Quem fala?');
    expect(demoLinesFor('en-US').intro('Ana')).toContain('This is Ana');
  });
});

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
