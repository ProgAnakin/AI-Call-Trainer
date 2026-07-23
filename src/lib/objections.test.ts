import { describe, expect, it } from 'vitest';
import { buildGauntlet, scoreObjectionResponse } from './objections';
import type { Product } from '@/types';

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
