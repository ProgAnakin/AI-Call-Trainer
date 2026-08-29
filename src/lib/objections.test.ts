import { describe, expect, it } from 'vitest';
import { buildGauntlet, localizedObjection, scoreObjectionResponse, weightOf } from './objections';
import type { ModelObjection, Product } from '@/types';

describe('scoreObjectionResponse', () => {
  it('scores an empty answer 0 with the silence tip', () => {
    const r = scoreObjectionResponse('   ', 'pt-BR');
    expect(r.score).toBe(0);
    expect(r.tipKeys).toContain('drill.tip.empty');
  });

  it('rewards acknowledge + explore + substance (pt)', () => {
    const r = scoreObjectionResponse(
      'Entendo sua preocupação com o preço. Posso te perguntar: quanto custa hoje um deal perdido por falta de follow-up?',
      'pt-BR',
    );
    expect(r.acknowledged).toBe(true);
    expect(r.explored).toBe(true);
    expect(r.substantive).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(8);
  });

  it('caps an instant rebuttal at a low score', () => {
    const r = scoreObjectionResponse('Não, você está errado.', 'pt-BR');
    expect(r.instantRebuttal).toBe(true);
    expect(r.score).toBeLessThanOrEqual(3);
    expect(r.tipKeys).toContain('drill.tip.noRebuttal');
  });

  it('recognises english acknowledge phrases', () => {
    const r = scoreObjectionResponse(
      'That’s fair. What would need to be true for this to be worth a look?',
      'en-US',
    );
    expect(r.acknowledged).toBe(true);
    expect(r.explored).toBe(true);
  });
});

describe('buildGauntlet', () => {
  const product = {
    id: 'p1',
    name: 'Test',
    vendor: 'V',
    one_liner: '',
    key_features: [],
    pricing_notes: '',
    competitors: [],
    common_objections: [
      { objection: 'a', model_answer: 'x' },
      { objection: 'b', model_answer: 'y' },
      { objection: 'c', model_answer: 'z' },
    ],
  } satisfies Product;

  it('returns at most `max` objections', () => {
    expect(buildGauntlet(product, 2)).toHaveLength(2);
    expect(buildGauntlet(product, 10)).toHaveLength(3);
  });
});

describe('localizedObjection', () => {
  const base: ModelObjection = {
    objection: 'It is too expensive.',
    model_answer: 'Compared to what?',
    i18n: {
      pt: { objection: 'É caro demais.', model_answer: 'Caro comparado a quê?' },
    },
  };

  it('returns the variant for a language that has one', () => {
    expect(localizedObjection(base, 'pt').objection).toBe('É caro demais.');
    expect(localizedObjection(base, 'pt').model_answer).toBe('Caro comparado a quê?');
  });

  it('falls back to the base text when the language is missing', () => {
    expect(localizedObjection(base, 'it').objection).toBe('It is too expensive.');
    expect(localizedObjection(base, 'en').objection).toBe('It is too expensive.');
  });

  it('tolerates an objection with no i18n at all (user-created products)', () => {
    const custom: ModelObjection = { objection: 'Custom', model_answer: 'Answer' };
    expect(localizedObjection(custom, 'pt')).toEqual(custom);
  });
});

describe('weightOf (adaptive gauntlet)', () => {
  it('gives never-trained objections the highest weight', () => {
    expect(weightOf(undefined)).toBe(12);
    expect(weightOf({ attempts: 0, avg: 0 })).toBe(12);
  });

  it('weights a weak objection above a strong one', () => {
    const weak = weightOf({ attempts: 3, avg: 2 });
    const strong = weightOf({ attempts: 3, avg: 9 });
    expect(weak).toBeGreaterThan(strong);
  });

  it('never drops to zero, so a mastered objection can still resurface', () => {
    expect(weightOf({ attempts: 10, avg: 10 })).toBeGreaterThan(0);
  });
});

describe('buildGauntlet', () => {
  const product = {
    id: 'p1',
    name: 'P',
    vendor: 'V',
    one_liner: '',
    key_features: [],
    pricing_notes: '',
    competitors: [],
    common_objections: [
      { objection: 'A', model_answer: '' },
      { objection: 'B', model_answer: '' },
      { objection: 'C', model_answer: '' },
      { objection: 'D', model_answer: '' },
    ],
  } as unknown as Product;

  it('shuffles and caps when there is no history', () => {
    const g = buildGauntlet(product, 3);
    expect(g).toHaveLength(3);
    expect(new Set(g.map((o) => o.objection)).size).toBe(3); // no repeats
  });

  it('prioritises the weakest objection when history exists', () => {
    // A is mastered, D was handled badly → D should come first with rnd=0,
    // which always picks the first item whose cumulative weight is reached.
    const stats = {
      A: { attempts: 5, avg: 10 },
      B: { attempts: 5, avg: 9 },
      C: { attempts: 5, avg: 9 },
      D: { attempts: 5, avg: 0 },
    };
    const picked = buildGauntlet(product, 4, stats, () => 0.999);
    expect(picked[0].objection).toBe('D');
  });

  it('never repeats an objection within one gauntlet', () => {
    const stats = { A: { attempts: 1, avg: 5 } };
    const g = buildGauntlet(product, 4, stats, () => 0.5);
    expect(new Set(g.map((o) => o.objection)).size).toBe(g.length);
  });

  it('caps at the number of available objections', () => {
    expect(buildGauntlet(product, 99, { A: { attempts: 1, avg: 1 } })).toHaveLength(4);
  });
});
