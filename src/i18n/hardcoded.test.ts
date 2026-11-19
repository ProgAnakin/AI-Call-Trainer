/**
 * Nenhum texto de interface pode ficar FORA do sistema de i18n.
 *
 * O app é trilíngue e o idioma padrão é inglês. Um texto escrito direto no JSX
 * aparece em inglês para quem escolheu português ou italiano — e o compilador
 * não avisa. Isto já aconteceu: as telas "Scenario not found" e "Scorecard not
 * found", o rótulo "prospect" do Drill, o aria-label do gráfico e as opções
 * "cold/aware/evaluating" (valores internos exibidos como texto) ficaram sem
 * tradução.
 *
 * Usa o parser do TypeScript em vez de regex: texto de JSX pode quebrar linha,
 * vir dentro de {' '} ou de uma expressão, e uma regex deixa isso passar.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

/** Atributos cujo valor é lido pelo usuário (ou por leitor de tela). */
const USER_FACING_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'label']);

/**
 * Textos que NÃO se traduzem: nome da marca, nome de um produto/licença. Qualquer
 * entrada nova aqui deve ter um motivo igualmente bom.
 */
const ALLOWED = new Set(['🎙️ AI Call Trainer', 'AI Call Trainer', 'GitHub · MIT']);

const hasWords = (s: string) => /[A-Za-zÀ-ÿ]{3,}/.test(s.replace(/&[a-z]+;/g, ''));

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(p);
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [p] : [];
  });
}

interface Hit {
  where: string;
  kind: string;
  text: string;
}

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const file of tsxFiles(SRC)) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const where = (n: ts.Node) =>
      `${relative(join(SRC, '..'), file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n)) {
        const text = n.getText().replace(/\s+/g, ' ').trim();
        if (text && hasWords(text)) hits.push({ where: where(n), kind: 'texto', text });
      }
      if (
        ts.isJsxAttribute(n) &&
        USER_FACING_ATTRS.has(n.name.getText()) &&
        n.initializer &&
        ts.isStringLiteral(n.initializer) &&
        hasWords(n.initializer.text)
      ) {
        hits.push({ where: where(n), kind: `atributo ${n.name.getText()}`, text: n.initializer.text });
      }
      if (
        ts.isJsxExpression(n) &&
        n.expression &&
        ts.isStringLiteral(n.expression) &&
        ts.isJsxElement(n.parent) &&
        hasWords(n.expression.text)
      ) {
        hits.push({ where: where(n), kind: 'expressão', text: n.expression.text });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return hits.filter((h) => !ALLOWED.has(h.text));
}

describe('i18n — nenhum texto de interface fora do dicionário', () => {
  it('não há texto, aria-label, placeholder ou title escritos direto no JSX', () => {
    const hits = scan();
    // Mensagem útil: onde está e o que é, para quem quebrou o teste.
    expect(
      hits.map((h) => `${h.where}  [${h.kind}]  "${h.text}"`),
      'mova estes textos para src/i18n/{en,pt,it}.ts e use t(...)',
    ).toEqual([]);
  });

  it('o próprio detector funciona (acha texto cru num trecho de exemplo)', () => {
    // Evita um teste verde por um scanner quebrado: valida o mecanismo.
    const sf = ts.createSourceFile(
      'x.tsx',
      `const A = () => <div title="Texto cru">Olá mundo <b>{'literal'}</b></div>;`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let found = 0;
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n) && hasWords(n.getText())) found++;
      if (ts.isJsxAttribute(n) && USER_FACING_ATTRS.has(n.name.getText())) found++;
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(found).toBeGreaterThanOrEqual(2);
  });
});
