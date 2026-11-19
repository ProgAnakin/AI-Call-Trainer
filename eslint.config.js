// ESLint (flat config). Foco em BUGS, não em estilo: não há Prettier nem regras de
// formatação aqui de propósito — a regra que mais rende é react-hooks, que pega
// efeitos com dependência faltando (o tipo de bug que o TypeScript não vê).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'supabase/dashboard-deploy', '.claude'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // Vale para tudo: o que começa com _ é intencionalmente ignorado.
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Edge Functions rodam em Deno; scripts e E2E em Node.
    files: ['supabase/**/*.ts', 'public/sw.js', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.serviceworker, Deno: 'readonly' } },
  },
  {
    // O E2E roda em Node, mas boa parte do código dentro de page.evaluate()
    // executa NO NAVEGADOR (window, document) — e injeta o axe-core na página.
    files: ['e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, axe: 'readonly' } },
  },
);
