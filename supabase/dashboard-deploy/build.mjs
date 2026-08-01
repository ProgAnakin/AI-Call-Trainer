// Generates the single-file dashboard-deploy versions of the Edge Functions
// from the canonical sources, so the two never drift. The Supabase dashboard
// deploys one file at a time and can't import ../_shared, hence the inlining.
//
//   node supabase/dashboard-deploy/build.mjs
//
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fns = join(here, '..', 'functions');

const shared = readFileSync(join(fns, '_shared', 'common.ts'), 'utf8');
// Inline the shared module: drop the `export ` keywords so everything is local.
const sharedInline = shared.replace(/^export /gm, '');

const HEADER = (name) =>
  `// =====================================================================\n` +
  `//  AI Call Trainer — Edge Function "${name}" (SINGLE-FILE / DASHBOARD)\n` +
  `//  AUTO-GENERATED from supabase/functions/_shared/common.ts + ${name}/index.ts\n` +
  `//  Do NOT edit by hand — run: node supabase/dashboard-deploy/build.mjs\n` +
  `//  Paste this whole file into the '${name}' function editor in Supabase.\n` +
  `// =====================================================================\n`;

function build(name) {
  const fn = readFileSync(join(fns, name, 'index.ts'), 'utf8')
    // remove the import of the shared module (now inlined above)
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/_shared\/common\.ts';\n/, '');
  const out = `${HEADER(name)}${sharedInline}\n${fn}`;
  writeFileSync(join(here, `${name}.ts`), out);
  console.log(`✓ ${name}.ts (${out.length} bytes)`);
}

build('roleplay');
build('evaluate');
