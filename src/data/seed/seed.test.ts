import { describe, expect, it } from 'vitest';
import type { CallType, Language, UiLanguage } from '@/types';
import { SEED_PERSONAS } from './personas';
import { SEED_PRODUCTS } from './products';
import { SEED_SCENARIOS } from './scenarios';

/**
 * O catálogo seed é dado escrito à mão, e nada o validava. Um `persona_id`
 * errado por um dígito não quebra o build nem o typecheck: o cenário aparece na
 * Home e só falha quando o usuário clica nele ("Scenario not found"). O mesmo
 * vale para uma tradução de objeção que ficou para trás — o drill cai de volta
 * para o inglês sem avisar ninguém.
 */

const LANGUAGES: Language[] = ['pt-BR', 'pt-PT', 'it-IT', 'en-US'];
const CALL_TYPES: CallType[] = ['cold_call', 'discovery', 'demo', 'negotiation'];
/** Idiomas de UI que o drill precisa ter traduzidos (en é o texto base). */
const TRANSLATED: UiLanguage[] = ['pt', 'it'];

const personaIds = new Set(SEED_PERSONAS.map((p) => p.id));
const productIds = new Set(SEED_PRODUCTS.map((p) => p.id));

describe('integridade referencial do seed', () => {
  it.each(SEED_SCENARIOS)('cenário $id aponta para uma persona que existe', (s) => {
    expect(personaIds, `persona_id ${s.persona_id} não existe`).toContain(s.persona_id);
  });

  it.each(SEED_SCENARIOS)('cenário $id aponta para um produto que existe', (s) => {
    expect(productIds, `product_id ${s.product_id} não existe`).toContain(s.product_id);
  });

  it('não tem ids duplicados em nenhuma coleção', () => {
    expect(personaIds.size).toBe(SEED_PERSONAS.length);
    expect(productIds.size).toBe(SEED_PRODUCTS.length);
    expect(new Set(SEED_SCENARIOS.map((s) => s.id)).size).toBe(SEED_SCENARIOS.length);
  });

  it('traz variedade suficiente para o treino ter sentido', () => {
    expect(SEED_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    // Pelo menos um cenário em cada idioma suportado, senão a seleção de
    // idioma da call fica sem conteúdo para oferecer.
    for (const lang of LANGUAGES) {
      expect(
        SEED_SCENARIOS.some((s) => s.language === lang),
        `nenhum cenário em ${lang}`,
      ).toBe(true);
    }
  });

  it('tem conteúdo para todo tipo de call declarado', () => {
    // `negotiation` já existiu como tipo órfão: tinha rótulo traduzido e opção
    // na Biblioteca, mas nenhum cenário — logo, nada para treinar.
    for (const type of CALL_TYPES) {
      expect(
        SEED_SCENARIOS.some((s) => s.call_type === type),
        `nenhum cenário do tipo ${type}`,
      ).toBe(true);
    }
  });
});

describe('sanidade dos cenários', () => {
  it.each(SEED_SCENARIOS)('cenário $id tem campos válidos', (s) => {
    expect(LANGUAGES).toContain(s.language);
    expect(s.difficulty).toBeGreaterThanOrEqual(1);
    expect(s.difficulty).toBeLessThanOrEqual(5);
    expect(s.time_limit_seconds).toBeGreaterThan(0);
    // O critério de sucesso vai no prompt do avaliador; vazio degrada a nota.
    expect(s.success_criteria.trim().length).toBeGreaterThan(10);
  });
});

describe('sanidade das personas', () => {
  it.each(SEED_PERSONAS)('persona $name tem material para o roleplay', (p) => {
    // Dores e objeções alimentam o prompt do prospect: vazias = persona sem graça.
    expect(p.pain_points.length).toBeGreaterThan(0);
    expect(p.hidden_objections.length).toBeGreaterThan(0);
    expect(p.pain_points.every((x) => x.trim().length > 0)).toBe(true);
    expect(p.hidden_objections.every((x) => x.trim().length > 0)).toBe(true);
    for (const v of Object.values(p.personality)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('sanidade dos produtos', () => {
  it.each(SEED_PRODUCTS)('produto $name tem objeções e features', (p) => {
    expect(p.common_objections.length).toBeGreaterThanOrEqual(3);
    expect(p.key_features.length).toBeGreaterThan(0);
    expect(p.competitors.length).toBeGreaterThan(0);
  });

  it.each(SEED_PRODUCTS)('produto $name tem toda objeção traduzida', (p) => {
    for (const o of p.common_objections) {
      for (const lang of TRANSLATED) {
        const variant = o.i18n?.[lang];
        expect(variant, `${p.name}: falta ${lang} em "${o.objection}"`).toBeDefined();
        expect(variant?.objection.trim().length ?? 0).toBeGreaterThan(0);
        expect(variant?.model_answer.trim().length ?? 0).toBeGreaterThan(0);
        // Igual ao base significa copy-paste, não tradução.
        expect(variant?.objection, `${p.name}: ${lang} não traduzido`).not.toBe(o.objection);
      }
    }
  });

  it.each(SEED_PRODUCTS)('produto $name não repete a mesma objeção', (p) => {
    const texts = p.common_objections.map((o) => o.objection);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
