import { describe, expect, it as test } from 'vitest';
import { pt } from './pt';
import { it } from './it';
import { en } from './en';

/**
 * O que o compilador já garante: `it` e `en` são anotados `typeof pt`, então
 * chave faltando ou sobrando é erro de tsc.
 *
 * O que ele NÃO garante, e é justamente o que quebra na tela:
 *  - valor vazio — a UI renderiza um buraco, sem aviso;
 *  - placeholder perdido na tradução — `'Seu recorde: {n}/100'` sem o `{n}`
 *    some com o número, porque `t()` só faz replace do que estiver no texto.
 */

const DICTS = { pt, it, en } as const;
const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(text: string): Set<string> {
  return new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]));
}

describe.each(Object.entries(DICTS))('dicionário %s', (name, dict) => {
  test('não tem valor vazio', () => {
    const empty = Object.entries(dict)
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k);
    expect(empty, `chaves vazias em ${name}`).toEqual([]);
  });

  test('não deixa chave crua sobrando no texto', () => {
    // Um `{0}` ou `{}` sem nome é sinal de interpolação mal escrita.
    const broken = Object.entries(dict)
      .filter(([, v]) => /\{\s*\}|\{\d+\}/.test(v as string))
      .map(([k]) => k);
    expect(broken, `interpolação inválida em ${name}`).toEqual([]);
  });
});

describe('paridade entre idiomas', () => {
  test('todos têm o mesmo conjunto de chaves', () => {
    // Redundante com o tsc por enquanto, mas prende o invariante caso a
    // anotação `typeof pt` seja removida um dia.
    const base = Object.keys(pt).sort();
    expect(Object.keys(it).sort()).toEqual(base);
    expect(Object.keys(en).sort()).toEqual(base);
  });

  test.each([
    ['it', it],
    ['en', en],
  ])('%s preserva os placeholders de pt', (name, dict) => {
    const mismatches: string[] = [];
    for (const [key, ptText] of Object.entries(pt)) {
      const expected = placeholders(ptText);
      if (expected.size === 0) continue;
      const got = placeholders((dict as Record<string, string>)[key] ?? '');
      for (const p of expected) {
        if (!got.has(p)) mismatches.push(`${key}: falta {${p}} em ${name}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
