/**
 * Gate anti-recaída de textos hardcodeados en templates.
 *
 * COMPLEMENTA a `check_i18n.ts`, no lo sustituye. Los dos miden cosas
 * distintas y hasta ahora eso no estaba dicho en ninguna parte:
 *
 *   - `check_i18n.ts` compara los BUNDLES entre sí (claves que faltan, valores
 *     sin traducir) y hace un escaneo de templates que solo caza palabras de
 *     una lista cerrada (`IT_WORD`), descartando ademas cualquier linea con
 *     `<`, `>`, comillas o `{{`. Un texto dentro de un atributo es invisible
 *     para él.
 *   - Este gate usa `@intlify/vue-i18n/no-raw-text`, que entiende el AST del
 *     template y ve TODO el texto visible, esté donde esté.
 *
 * El resultado práctico: `check_i18n.ts` reportaba «italiano hardcoded: 0»
 * mientras la UI enseñaba «Filtri realtime», «Tratte» o «Verifica in corso…»
 * a un usuario en español. El linter los veía; nadie lo ejecutaba bloqueando,
 * porque el script `lint` de cada app corre con `--fix` y su salida se ignora.
 *
 * Política: NO se exige 0 (hoy son decenas y arreglarlas es otro trabajo). Se
 * exige NO EMPEORAR respecto a `raw_text_baseline.json`, igual que hace
 * `check_i18n.ts` con `missing`/`untranslated`. Al bajar, se recongela:
 *
 *   pnpm check:raw-text            → falla si sube respecto al baseline
 *   pnpm check:raw-text --update   → recongela (hazlo al mejorar)
 *   pnpm check:raw-text --report   → detalle por app y por literal, sin fallar
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const APPS = join(ROOT, 'apps');
const BASELINE_PATH = join(__dirname, 'raw_text_baseline.json');

const update = process.argv.includes('--update');
const reportOnly = process.argv.includes('--report');

interface Baseline {
  total: number;
  perApp: Record<string, number>;
  note?: string;
}

/** Un aviso `no-raw-text` de ESLint, ya reducido a lo que interesa. */
interface Hit {
  app: string;
  file: string;
  line: number;
  text: string;
}

/** Formato mínimo del JSON de ESLint que consumimos. */
interface EslintMessage {
  ruleId: string | null;
  line: number;
  message: string;
}
interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
}

function appDirs(): string[] {
  return readdirSync(APPS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(APPS, e.name, 'eslint.config.js')))
    .map((e) => e.name);
}

/**
 * Corre ESLint en una app y devuelve solo los avisos de `no-raw-text`.
 *
 * `--no-fix` explícito: el script `lint` de cada app usa `--fix`, y este gate
 * NUNCA debe escribir en los fuentes.
 */
function scanApp(app: string): Hit[] {
  const cwd = join(APPS, app);
  let raw = '';
  try {
    raw = execFileSync(
      'npx',
      ['eslint', 'src/', '--no-fix', '--format', 'json'],
      { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (e) {
    // ESLint sale con código 1 cuando hay errores: eso es lo NORMAL aquí, y su
    // stdout sigue siendo el JSON que queremos.
    const err = e as { stdout?: string };
    raw = err.stdout ?? '';
  }
  if (!raw.trim()) return [];

  let results: EslintFileResult[];
  try {
    results = JSON.parse(raw) as EslintFileResult[];
  } catch {
    console.error(`  ! no se pudo parsear la salida de ESLint en ${app}`);
    return [];
  }

  const hits: Hit[] = [];
  for (const f of results) {
    for (const m of f.messages) {
      if (m.ruleId !== '@intlify/vue-i18n/no-raw-text') continue;
      // `[\s\S]` y no `.`: un texto partido en varias líneas del template llega
      // con saltos dentro del mensaje, y con `.` la captura fallaba y se
      // imprimía el mensaje de ESLint entero como si fuera el literal.
      const text = (/raw text '([\s\S]*)' is used/.exec(m.message)?.[1] ?? m.message)
        .replace(/\s+/g, ' ')
        .trim();
      hits.push({
        app,
        file: f.filePath.replace(ROOT + '/', ''),
        line: m.line,
        text,
      });
    }
  }
  return hits;
}

const apps = appDirs();
const all: Hit[] = [];
for (const app of apps) all.push(...scanApp(app));

const perApp: Record<string, number> = {};
for (const app of apps) perApp[app] = all.filter((h) => h.app === app).length;
const total = all.length;

const baseline: Baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline)
  : { total: Number.POSITIVE_INFINITY, perApp: {} };

console.log('gate raw-text (textos hardcodeados en templates)');
console.log('===============================================');
for (const app of apps) {
  const base = baseline.perApp[app];
  const now = perApp[app];
  const mark = base === undefined ? '' : now > base ? '  ← SUBE' : now < base ? '  ← baja' : '';
  console.log(`  ${app.padEnd(24)} ${String(now).padStart(4)}  (baseline ${base ?? '—'})${mark}`);
}
console.log(`  ${'TOTAL'.padEnd(24)} ${String(total).padStart(4)}  (baseline ${baseline.total})`);

if (reportOnly) {
  console.log('\n--- por literal ---');
  const byText = new Map<string, number>();
  for (const h of all) byText.set(h.text, (byText.get(h.text) ?? 0) + 1);
  [...byText.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([text, n]) => console.log(`  ${String(n).padStart(3)}×  ${JSON.stringify(text)}`));

  console.log('\n--- por fichero ---');
  const byFile = new Map<string, number>();
  for (const h of all) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
  [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .forEach(([file, n]) => console.log(`  ${String(n).padStart(3)}×  ${file}`));
}

if (update) {
  const next: Baseline = {
    total,
    perApp,
    note: 'Congelado por check_raw_text.ts --update. Solo puede bajar: si sube, es regresión.',
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`\n✓ baseline recongelado en ${total}`);
  process.exit(0);
}

if (reportOnly) process.exit(0);

// Se compara por app además del total: dos apps que se compensan entre sí
// (una sube 5, otra baja 5) dejarían el total igual y la regresión pasaría.
const regressions: string[] = [];
if (total > baseline.total) {
  regressions.push(`total ${baseline.total} -> ${total}`);
}
for (const app of apps) {
  const base = baseline.perApp[app];
  if (base !== undefined && perApp[app] > base) {
    regressions.push(`${app} ${base} -> ${perApp[app]}`);
  }
}

if (regressions.length) {
  console.log('\n✗ gate raw-text FALLA:');
  for (const r of regressions) console.log(`   - ${r}`);
  console.log('\nUsa t() para el texto nuevo. Si de verdad no es traducible');
  console.log('(unidades, siglas), añádelo a packages/platform/eslint/i18n-no-raw-text.js.');
  console.log('Si la subida es intencionada: pnpm check:raw-text --update');
  process.exit(1);
}

if (total < baseline.total) {
  console.log(`\n✓ mejora: ${baseline.total} -> ${total}. Recongela con --update.`);
} else {
  console.log('\n✓ sin regresión');
}
