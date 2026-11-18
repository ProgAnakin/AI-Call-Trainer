/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          raised: '#171a23',
          overlay: '#1f2330',
        },
        // Contraste WCAG AA (4.5:1) medido com axe-core. Os valores padrão do
        // Tailwind falhavam nas superfícies escuras: branco sobre #6366f1 dá 4.47
        // e slate-500 (#64748b) dá 3.3–4.0 conforme o fundo.
        accent: {
          // 4.93:1 com texto branco. Visualmente quase idêntico ao índigo anterior.
          DEFAULT: '#5b5eec',
          // Só para TEXTO/ícone sobre fundo escuro (6+:1). Nunca como fundo de
          // botão com texto branco: dá 2.98 — por isso existe `hover` abaixo.
          soft: '#818cf8',
          // Hover de botões: escurece em vez de clarear, mantendo 5.76:1.
          hover: '#4f52e3',
        },
        slate: {
          // Texto auxiliar. 4.82:1 sobre surface-overlay (o pior fundo) e ainda
          // mais apagado que slate-400, então a hierarquia visual se mantém.
          // Só `text-slate-500` e placeholders usam esta tonalidade.
          500: '#8190a5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
};
