import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeEmail, getEmailBest, saveEmailBest, type EmailInput } from './coldEmail';

const check = (a: ReturnType<typeof analyzeEmail>, key: string) =>
  a.checks.find((c) => c.key === key)?.pass;

const STRONG: EmailInput = {
  lang: 'en',
  subject: 'Quick question about ramping new reps',
  body:
    'Noticed your team grew fast this year. Most heads of sales we hear from say new reps take three ' +
    'months to ramp because nothing is documented, so deals stall. Curious how you handle that today? ' +
    'If it is a priority for you, would a short call next week be worth 15 minutes of your time?',
};

describe('analyzeEmail', () => {
  it('scores a well-formed email highly', () => {
    const a = analyzeEmail(STRONG);
    expect(a.score).toBeGreaterThanOrEqual(80);
    expect(check(a, 'cta')).toBe(true);
    expect(check(a, 'youFocused')).toBe(true);
    expect(check(a, 'noSpam')).toBe(true);
    expect(a.tips).toContain('email.tip.solid');
  });

  it('returns 0 and one tip for an empty body', () => {
    const a = analyzeEmail({ lang: 'en', subject: 's', body: '' });
    expect(a.score).toBe(0);
    expect(a.wordCount).toBe(0);
    expect(a.tips).toEqual(['email.tip.empty']);
  });

  it('flags a missing call to action', () => {
    const a = analyzeEmail({
      lang: 'en',
      subject: 'Following up',
      body:
        'We are a leading platform that helps companies of your size improve their sales process ' +
        'and we have many happy customers across the region who love what we do every single day.',
    });
    expect(check(a, 'cta')).toBe(false);
    expect(a.tips).toContain('email.tip.cta');
  });

  it('penalizes spam words', () => {
    const a = analyzeEmail({
      lang: 'en',
      subject: 'FREE guaranteed offer',
      body: 'Act now for a 100% risk-free guarantee. Click here to buy now, limited time only! Best price!',
    });
    expect(check(a, 'noSpam')).toBe(false);
    expect(check(a, 'lowExclaim')).toBe(false);
    expect(a.tips).toContain('email.tip.spam');
  });

  it('flags a "me-focused" email', () => {
    const a = analyzeEmail({
      lang: 'en',
      subject: 'About us',
      body:
        'I am writing because we built a product and we are proud of it. We think we are the best and ' +
        'I would love to tell you all about everything we do and how we do it and why we are great.',
    });
    expect(check(a, 'youFocused')).toBe(false);
    expect(a.tips).toContain('email.tip.youFocused');
  });

  it('flags a clichéd opener', () => {
    const a = analyzeEmail({
      lang: 'en',
      subject: 'Hello',
      body:
        'I hope this email finds you well. Could we find 15 minutes for a quick call next week to see ' +
        'how you handle onboarding today, since it matters to you and your growing team this quarter?',
    });
    expect(check(a, 'noCliche')).toBe(false);
    expect(a.tips).toContain('email.tip.cliche');
  });

  it('flags too-short and too-long bodies', () => {
    const short = analyzeEmail({ lang: 'en', subject: 'Hi', body: 'Wanna talk? Call me.' });
    expect(check(short, 'concise')).toBe(false);
    expect(short.tips).toContain('email.tip.tooShort');

    const long = analyzeEmail({ lang: 'en', subject: 'Hi', body: Array(200).fill('word').join(' ') });
    expect(check(long, 'concise')).toBe(false);
    expect(long.tips).toContain('email.tip.tooLong');
  });

  it('works in Portuguese', () => {
    const a = analyzeEmail({
      lang: 'pt',
      subject: 'Pergunta rápida sobre onboarding',
      body:
        'Notei que seu time cresceu rápido este ano. A maioria dos líderes com quem falamos diz que o ' +
        'onboarding de vendedor novo leva meses porque nada está documentado. Como você lida com isso ' +
        'hoje? Se for prioridade para você, vale uma call de 15 minutos na semana que vem?',
    });
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(check(a, 'cta')).toBe(true);
    expect(check(a, 'youFocused')).toBe(true);
  });
});

describe('email best-score persistence', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts empty, then records and beats a best', () => {
    expect(getEmailBest()).toBeNull();
    expect(saveEmailBest(60)).toBe(false); // first save is not "beating" a record
    expect(getEmailBest()).toBe(60);
    expect(saveEmailBest(50)).toBe(false); // worse: no change
    expect(getEmailBest()).toBe(60);
    expect(saveEmailBest(85)).toBe(true); // new record
    expect(getEmailBest()).toBe(85);
  });
});
