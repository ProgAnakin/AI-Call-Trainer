import { describe, expect, it } from 'vitest';
import { computeMetrics, countQuestions, formatDuration, formatTalkRatio, talkRatio, wordCount } from './metrics';
import { weightedOverall } from '@/data/frameworks';

describe('wordCount', () => {
  it('counts words separated by any whitespace', () => {
    expect(wordCount('olá, tudo bem com você?')).toBe(5);
    expect(wordCount('  a\n b\tc  ')).toBe(3);
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });
});

describe('talkRatio', () => {
  it('splits words between rep and prospect', () => {
    const r = talkRatio([
      { speaker: 'rep', content: 'uma duas três quatro' },
      { speaker: 'prospect', content: 'uma duas três quatro cinco seis' },
    ]);
    expect(r.repWords).toBe(4);
    expect(r.prospectWords).toBe(6);
    expect(r.rep).toBeCloseTo(0.4);
  });

  it('returns 0 for empty transcript', () => {
    expect(talkRatio([]).rep).toBe(0);
  });
});

describe('countQuestions', () => {
  it('counts only rep questions and collapses ??? into one', () => {
    const n = countQuestions([
      { speaker: 'rep', content: 'Como funciona hoje? E quanto custa?' },
      { speaker: 'rep', content: 'Sério??? Sem pergunta aqui.' },
      { speaker: 'prospect', content: 'Quem é você?' },
    ]);
    expect(n).toBe(3);
  });
});

describe('computeMetrics', () => {
  it('computes duration from timestamps', () => {
    const m = computeMetrics(
      [{ speaker: 'rep', content: 'oi?' }],
      '2026-01-01T10:00:00Z',
      '2026-01-01T10:04:30Z',
    );
    expect(m.durationSeconds).toBe(270);
    expect(m.questionsAsked).toBe(1);
  });
});

describe('formatters', () => {
  it('formats duration mm:ss', () => {
    expect(formatDuration(270)).toBe('4:30');
    expect(formatDuration(59)).toBe('0:59');
  });

  it('formats talk ratio', () => {
    expect(formatTalkRatio(0.6)).toBe('rep 60% / prospect 40%');
  });
});

describe('weightedOverall', () => {
  it('weights criteria according to the framework', () => {
    const overall = weightedOverall('basic', {
      abertura: { score: 10 },
      descoberta: { score: 10 },
      escuta_ativa: { score: 10 },
      tratamento_objecoes: { score: 10 },
      clareza_valor: { score: 10 },
      proximo_passo: { score: 10 },
    });
    expect(overall).toBe(100);
  });

  it('ignores missing criteria instead of zeroing the score', () => {
    const overall = weightedOverall('basic', {
      descoberta: { score: 5 },
    });
    expect(overall).toBe(50);
  });
});
