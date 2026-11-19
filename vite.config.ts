import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // As Edge Functions importam `npm:@supabase/supabase-js@2` (especificador do
      // Deno). Nos testes isso vira um Supabase falso em memória, para atacar o
      // código real de produção sem tocar nele. O build do app não importa
      // supabase/, então o alias só vale para o vitest.
      'npm:@supabase/supabase-js@2': path.resolve(
        __dirname,
        'supabase/functions/_testing/fake-supabase.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
  },
});
