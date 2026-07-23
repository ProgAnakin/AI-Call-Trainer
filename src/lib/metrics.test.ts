import { describe, expect, it } from 'vitest';
import {
  classifyQuestions,
  computeMetrics,
  countFillers,
  countQuestions,
  detectNextStep,
  formatDuration,
  formatTalkRatio,
  longestMonologue,
  talkRatio,
  timeToFirstQuestion,
  wordCount,
} from './metrics';
import { frameworkForCallType, weightedOverall } from '@/data/frameworks';

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

describe('longestMonologue', () => {
  it('returns the word count of the rep’s longest single turn', () => {
    const turns = [
      { speaker: 'rep' as const, content: 'uma duas três' },
      { speaker: 'prospect' as const, content: 'a b c d e f g' },
      { speaker: 'rep' as const, content: 'uma duas três quatro cinco' },
    ];
    expect(longestMonologue(turns, 'rep')).toBe(5);
  });
});

describe('classifyQuestions', () => {
  it('splits rep questions into open and closed (pt)', () => {
    const turns = [
      { speaker: 'rep' as const, content: 'Como funciona o processo hoje? Você tem budget?' },
      { speaker: 'prospect' as const, content: 'Depende. E o que mais?' },
      { speaker: 'rep' as const, content: 'Me conta mais sobre isso?' },
    ];
    const r = classifyQuestions(turns, 'pt-BR');
    expect(r.open).toBe(2); // "como", "me conta"
    expect(r.closed).toBe(1); // "você tem..."
  });

  it('recognises english open starters', () => {
    const r = classifyQuestions(
      [{ speaker: 'rep' as const, content: 'What is your stack? Do you have budget?' }],
      'en-US',
    );
    expect(r.open).toBe(1);
    expect(r.closed).toBe(1);
  });

  it('ignores a leading conjunction ("E qual..." counts as open)', () => {
    const r = classifyQuestions(
      [{ speaker: 'rep' as const, content: 'E qual é o maior gargalo?' }],
      'pt-BR',
    );
    expect(r.open).toBe(1);
    expect(r.closed).toBe(0);
  });
});

describe('countFillers', () => {
  it('counts filler words at word boundaries (pt)', () => {
    const n = countFillers(
      [{ speaker: 'rep' as const, content: 'Tipo, então sabe, é isso.' }],
      'pt-BR',
    );
    expect(n).toBe(3); // tipo, então, sabe
  });

  it('ignores fillers inside larger words', () => {
    const n = countFillers([{ speaker: 'rep' as const, content: 'entãozão sabenado' }], 'pt-BR');
    expect(n).toBe(0);
  });
});

describe('detectNextStep', () => {
  it('detects a concrete day/time in a rep turn', () => {
    expect(
      detectNextStep([{ speaker: 'rep' as const, content: 'Quinta às 10h funciona?' }], 'pt-BR'),
    ).toBe(true);
    expect(
      detectNextStep([{ speaker: 'rep' as const, content: 'Vou pensar e te falo.' }], 'pt-BR'),
    ).toBe(false);
  });
});

describe('timeToFirstQuestion', () => {
  it('returns seconds to the first rep question when timestamps exist', () => {
    const start = '2026-01-01T10:00:00Z';
    const turns = [
      { speaker: 'rep' as const, content: 'Oi, tudo bem.', ts: '2026-01-01T10:00:05Z' },
      { speaker: 'rep' as const, content: 'Como vocês fazem isso?', ts: '2026-01-01T10:00:35Z' },
    ];
    expect(timeToFirstQuestion(turns, start)).toBe(35);
  });

  it('returns null without timestamps', () => {
    expect(
      timeToFirstQuestion([{ speaker: 'rep' as const, content: 'Como assim?' }], '2026-01-01T10:00:00Z'),
    ).toBeNull();
  });
});

describe('computeMetrics — extended', () => {
  it('computes pace only for windows ≥ 5s and fills all fields', () => {
    const turns = [
      { speaker: 'rep' as const, content: 'Oi, como vai? Me conta do processo?', ts: '2026-01-01T10:00:10Z' },
      { speaker: 'prospect' as const, content: 'Tudo bem, é complicado.' },
    ];
    const m = computeMetrics(turns, '2026-01-01T10:00:00Z', '2026-01-01T10:01:00Z', 'pt-BR');
    expect(m.durationSeconds).toBe(60);
    expect(m.wordsPerMinute).not.toBeNull();
    expect(m.openQuestions + m.closedQuestions).toBe(2);
    expect(m.longestRepMonologue).toBeGreaterThan(0);
  });

  it('returns null pace for text-mode-like zero-duration calls', () => {
    const now = '2026-01-01T10:00:00Z';
    const m = computeMetrics([{ speaker: 'rep' as const, content: 'Oi?' }], now, now, 'pt-BR');
    expect(m.wordsPerMinute).toBeNull();
  });
});

describe('frameworkForCallType', () => {
  it('maps call types to the right rubric', () => {
    expect(frameworkForCallType('cold_call')).toBe('basic');
    expect(frameworkForCallType('discovery')).toBe('SPICED');
    expect(frameworkForCallType('negotiation')).toBe('MEDDIC');
    expect(frameworkForCallType('demo')).toBe('basic');
  });
});
