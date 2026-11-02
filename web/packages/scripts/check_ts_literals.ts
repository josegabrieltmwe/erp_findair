/**
 * Gate de textos fijos en validadores `.ts` (H23).
 *
 * `check_raw_text.ts` solo ve templates `.vue`; los validadores (`validation/*.ts`, `*Rules.ts`) devolvian
 * mensajes en italiano que ningun gate veia. Aqui se exige que un validador devuelva una CLAVE i18n
 * (`modulo.validation.motivo`) y que el texto lo resuelva `t()` al final.
 *
 * Regla: en esos ficheros, ningun literal de cadena puede contener dos palabras separadas por espacio
 * (eso es una frase), salvo que la linea lleve `// i18n-ok`. Sin baseline: debe dar 0.
 *
 *   pnpm check:ts-literals
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN = [join(ROOT, 'apps'), join(ROOT, 'packages', 'platform')];
const IS_TARGET = /(\/validation\/[^/]+\.ts|Rules\.ts)$/;
const IS_SPEC = /\.spec\.ts$/;
const SENTENCE = /[A-Za-zÀ-ÿ]{2,}[,:;.]?\s+[A-Za-zÀ-ÿ]{2,}/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (IS_TARGET.test(p) && !IS_SPEC.test(p)) out.push(p);
  }
  return out;
}

/** Quita comentarios conservando saltos de linea (para no mover los numeros de linea). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (_m, pre) => pre);
}

const hits: string[] = [];
for (const base of SCAN) {
  for (const file of walk(base)) {
    const raw = readFileSync(file, 'utf-8').split('\n');
    const lines = stripComments(readFileSync(file, 'utf-8')).split('\n');
    lines.forEach((ln, i) => {
      if (/^\s*import\b/.test(ln) || raw[i].includes('i18n-ok')) return;
      for (const m of ln.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
        if (SENTENCE.test(m[2])) hits.push(`${file.replace(ROOT + '/', '')}:${i + 1}  ${JSON.stringify(m[2].slice(0, 70))}`);
      }
    });
  }
}

if (hits.length) {
  console.error(`ts-literals: ${hits.length} frase(s) fija(s) en validadores (usa claves i18n):`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log('ts-literals: 0 frases fijas en validadores');
