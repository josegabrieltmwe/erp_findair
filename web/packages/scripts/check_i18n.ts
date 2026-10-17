/**
 * i18n regression gate.
 *
 * Detecta las tres formas en que el i18n se rompió históricamente en este
 * monorepo, y falla SOLO si el estado empeora respecto a la línea base
 * congelada en `i18n_baseline.json`:
 *
 *   1. SWITCHER_MISMATCH — una app que monta PlatformTopBar (y por tanto
 *      muestra el selector de idiomas) sin cargar en `createI18n` todos los
 *      idiomas que el selector ofrece. Este era EL bug: operations ofrecía
 *      🇳🇱/🇩🇪 sin poder cargarlos, el locale guardado no se reconocía, se caía
 *      al idioma de la sesión PHP y la UI salía ENTERA en italiano.
 *      Es un fallo estructural: cuenta siempre, no admite baseline.
 *
 *   2. MISSING_KEYS — claves presentes en el bundle de referencia (it) que
 *      faltan en otro idioma. vue-i18n cae al fallback, así que no revienta,
 *      pero el texto sale en otro idioma sin avisar.
 *
 *   3. UNTRANSLATED — valores idénticos al italiano en un bundle no italiano.
 *      Se ignoran los términos internacionales legítimos (Cargo, Tracking,
 *      AWB, Partner, Login…) vía INTERNATIONAL, y las cadenas sin letras
 *      (números, placeholders `{x}`, símbolos).
 *
 *   4. MOJIBAKE / DB_LEAK — UTF-8 mal decodificado (`Ã`) o valores que son
 *      nombres de tabla/columna (`spedizioni.presa_numero`) usados como
 *      texto visible. Ambos son siempre error: baseline 0, sin tolerancia.
 *
 * Uso:
 *   pnpm check:i18n              → falla si hay regresión respecto al baseline
 *   pnpm check:i18n --update     → recongela el baseline (hazlo al mejorar)
 *   pnpm check:i18n --report     → informe completo, sin fallar
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const APPS = join(ROOT, 'apps');
const BASELINE_PATH = join(__dirname, 'i18n_baseline.json');

/** Idiomas que el LanguageSwitcher compartido sabe ofrecer. */
const SWITCHER_LOCALES = ['it', 'en', 'es', 'nl', 'de'] as const;

/**
 * Términos que son iguales en varios idiomas por ser nombres propios,
 * siglas del sector o anglicismos ya asentados. Que coincidan con el
 * italiano no significa que estén sin traducir.
 */
const INTERNATIONAL = new Set(
  [
    'cargo', 'tracking', 'partner', 'partners', 'login', 'logout', 'email',
    'e-mail', 'mail', 'fax', 'export', 'import', 'task', 'awb', 'hawb', 'mawb',
    'admin', 'home', 'dashboard', 'copilot', 'crm', 'cod', 'iban', 'swift',
    'reset', 'ok', 'id', 'url', 'pdf', 'csv', 'excel', 'xml', 'api', 'ai',
    'no', 'file', 'server', 'client', 'online', 'offline', 'standard', 'extra',
    'express', 'freight', 'assistance', 'warehouse', 'administrative',
    'commercial', 'settings', 'mailing list', 'sistema', 'status', 'stop',
    'pallet', 'container', 'hub', 'gateway', 'hold', 'label', 'report',
  ].map((s) => s.toLowerCase()),
);

/** Nombres de tabla/columna del legacy que nunca deben ser texto visible. */
const DB_LEAK_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]{2,}$/;
/** UTF-8 releído como Latin-1: "societÃ ", "perchÃ©"… */
const MOJIBAKE_RE = /[ÃÂ][-¿‘-”™ ]/;

type Json = Record<string, unknown>;

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Json)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

function readJson(p: string): Json {
  return JSON.parse(readFileSync(p, 'utf-8')) as Json;
}

/** Todos los directorios de locales: apps/<a>/src/locales y sus modules. */
function localeDirs(): string[] {
  const dirs: string[] = [];
  for (const app of readdirSync(APPS)) {
    const base = join(APPS, app, 'src', 'locales');
    if (existsSync(base)) dirs.push(base);
    const mods = join(APPS, app, 'src', 'modules');
    if (!existsSync(mods)) continue;
    for (const m of readdirSync(mods)) {
      const d = join(mods, m, 'locales');
      if (existsSync(d)) dirs.push(d);
    }
  }
  return dirs;
}

const rel = (p: string) => p.replace(ROOT + '/', '');

// ---------------------------------------------------------------------------
// 1. Coherencia selector ↔ locales realmente cargados
// ---------------------------------------------------------------------------
interface SwitcherIssue { app: string; offered: string[]; loaded: string[]; missing: string[] }

function checkSwitcher(): SwitcherIssue[] {
  const issues: SwitcherIssue[] = [];
  for (const app of readdirSync(APPS)) {
    const src = join(APPS, app, 'src');
    const plugin = join(src, 'plugins', 'i18n.ts');
    if (!existsSync(plugin)) continue;

    // ¿Monta el top bar compartido (y por tanto el selector)?
    let usesTopBar = false;
    const walk = (dir: string): void => {
      if (usesTopBar || !existsSync(dir)) return;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (usesTopBar) return;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(vue|ts)$/.test(e.name) && readFileSync(p, 'utf-8').includes('PlatformTopBar')) {
          usesTopBar = true;
        }
      }
    };
    walk(src);
    if (!usesTopBar) continue;

    const source = readFileSync(plugin, 'utf-8');
    const m = source.match(/messages:\s*\{([^}]*)\}/);
    if (!m) continue;
    // Claves del objeto messages: `en`, `it`, `nl: en`, … Se usa lookahead
    // para el separador: consumir la coma hacía que se saltara una entrada
    // de cada dos ("en, it, es, nl, de" -> en, es, de) y disparaba falsos
    // positivos en apps que sí cargaban los cinco idiomas.
    const loaded = [...m[1].matchAll(/([a-z]{2})\s*(?=[:,]|\s*$)/g)].map((x) => x[1]);
    const missing = SWITCHER_LOCALES.filter((l) => !loaded.includes(l));
    if (missing.length) {
      issues.push({ app, offered: [...SWITCHER_LOCALES], loaded, missing });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// 2-4. Calidad de los bundles
// ---------------------------------------------------------------------------
interface DirStat { dir: string; missing: number; untranslated: number }
const mojibake: string[] = [];
const hardcoded: string[] = [];
const dbLeaks: string[] = [];

function checkBundles(): DirStat[] {
  const stats: DirStat[] = [];
  for (const dir of localeDirs()) {
    const itPath = join(dir, 'it.json');
    if (!existsSync(itPath)) continue;
    const it = flatten(readJson(itPath));
    // Referencia inglesa: sirve para distinguir "sin traducir" de "el original
    // ya estaba en inglés" (ver el filtro más abajo).
    const enPath = join(dir, 'en.json');
    const en: Record<string, string> = existsSync(enPath) ? flatten(readJson(enPath)) : {};
    let missing = 0;
    let untranslated = 0;

    for (const lang of SWITCHER_LOCALES) {
      const p = join(dir, `${lang}.json`);
      if (!existsSync(p)) continue; // ausencia = decisión de producto, no error
      const cur = flatten(readJson(p));

      for (const [k, v] of Object.entries(cur)) {
        if (MOJIBAKE_RE.test(v)) mojibake.push(`${rel(p)} :: ${k} = ${JSON.stringify(v)}`);
        if (DB_LEAK_RE.test(v.trim())) dbLeaks.push(`${rel(p)} :: ${k} = ${JSON.stringify(v)}`);
      }

      if (lang === 'it') continue;
      for (const k of Object.keys(it)) if (!(k in cur)) missing++;
      for (const [k, v] of Object.entries(cur)) {
        if (it[k] !== v) continue;
        if (!/[A-Za-zÀ-ÿ]/.test(v)) continue;              // números/símbolos
        if (INTERNATIONAL.has(v.trim().toLowerCase())) continue;
        if (v.trim().length < 4) continue;                  // siglas cortas
        // Si el bundle INGLÉS tiene el mismo valor que el italiano, la cadena
        // ya venía en inglés (o es un nombre propio) en el origen: que nl/de
        // coincidan no significa que falte traducirla. Sin este filtro el
        // contador mezclaba deuda real con etiquetas tipo "Pickup - Unconfirmed"
        // del catálogo de navegación, y subía al AÑADIR traducciones.
        if (en[k] === it[k]) continue;
        untranslated++;
      }
    }
    stats.push({ dir: rel(dir), missing, untranslated });
  }
  return stats;
}


// ---------------------------------------------------------------------------
// 5. Texto italiano HARDCODEADO en templates .vue (no pasa por t())
// ---------------------------------------------------------------------------
/**
 * Un bundle puede estar traducido al 100% y aun así verse italiano si el texto
 * está escrito a pelo en el template. Pasó con "Vedi tutti" y con el contador
 * "3 categorie · 13 indicatori": solo se detectaron ABRIENDO la app. Este
 * escaneo los caza en CI.
 *
 * ⚠️ COBERTURA PARCIAL — este escaneo NO es el gate de textos hardcodeados.
 *
 * Es deliberadamente conservador (cero falsos positivos a cambio de falsos
 * negativos): solo mira palabras de la lista `IT_WORD` y descarta toda línea
 * que contenga `<`, `>`, comillas o `{{`, así que un texto dentro de un
 * atributo o mezclado con marcado le pasa desapercibido. Tampoco ve el inglés
 * hardcodeado.
 *
 * Resultado real medido (2026-08-07): este contador daba 0 mientras la UI
 * enseñaba "Filtri realtime", "Tratte" y "Verifica in corso…" a usuarios en
 * español — 66 textos crudos que aquí no aparecían.
 *
 * El gate de verdad es `check_raw_text.ts` (`pnpm check:raw-text`), que usa
 * `@intlify/vue-i18n/no-raw-text` sobre el AST del template y ve TODO el texto
 * visible. Los dos son complementarios: aquel vigila el template, este
 * compara los bundles entre sí. NO interpretar un 0 aquí como "no hay texto
 * hardcodeado".
 */
const IT_WORD = /\b(vedi|tutti|tutte|categorie|indicatori|nessun|nessuna|nessuno|caricamento|attendere|spedizione|spedizioni|ritiro|ritiri|consegna|consegne|cliente|clienti|corriere|corrieri|fornitore|fattura|fatture|apri|chiudi|salva|elimina|modifica|inserisci|aggiungi|cerca|invia|scegli|seleziona|conferma|annulla|errore|avviso|obbligatorio|mittente|destinatario|giacenza|giacenze|presa|prese|listino|listini|assegno|assegni|busta|buste|volo|voli|prezzo|importo|valuta|bancale|doganale)\b/i;
const IT_AMBIG = /^(dati|note|tipo|numero|stato|import|export|partner|cargo|tracking|admin|home|no|ok)$/i;

function scanHardcodes(dir: string): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'locales' && e.name !== 'dist') scanHardcodes(p);
      continue;
    }
    if (!e.name.endsWith('.vue')) continue;
    const src = readFileSync(p, 'utf-8');
    const cut = src.indexOf('<script');
    const tpl = (cut === -1 ? src : src.slice(0, cut)).replace(/<!--[\s\S]*?-->/g, '');
    tpl.split('\n').forEach((ln, i) => {
      const t = ln.trim();
      if (!t || t.includes('<') || t.includes('>')) return;
      if (t.includes('{{') || t.includes('}}')) return;
      if (/^[:@v#]/.test(t) || /^[a-zA-Z-]+=/.test(t)) return;
      if (t.includes('t(') || t.includes('$t')) return;
      // Expresión JS partida en varias líneas dentro de una interpolación
      // (`data.fatture.length`): no es texto visible.
      if (/^[A-Za-z_$][\w$]*(\.[\w$]+)+$/.test(t)) return;
      if (t.includes('"') || t.includes("'")) return;
      if (!/[A-Za-zÀ-ÿ]/.test(t) || !IT_WORD.test(t) || IT_AMBIG.test(t)) return;
      hardcoded.push(`${rel(p)}:${i + 1}  ${JSON.stringify(t.slice(0, 60))}`);
    });
  }
}
scanHardcodes(APPS);
scanHardcodes(join(ROOT, 'packages'));

// ---------------------------------------------------------------------------
// 6. DYNAMIC_KEYS — claves construidas con template strings
// ---------------------------------------------------------------------------
/**
 * Los checks 2/3 comparan bundles ENTRE idiomas: detectan que a `nl` le falte
 * algo que `it` tiene, pero no que el CÓDIGO pida una clave que no existe en
 * NINGÚN idioma. Cuando además la llamada lleva fallback —
 * `t('kpi.section.morning.title', section.title)` — vue-i18n devuelve el
 * literal y no hay ningún síntoma: el gate pasa en verde y la UI muestra el
 * hardcode en su idioma original.
 *
 * Eso es exactamente lo que ocurrió con las pestañas del cockpit: el catálogo
 * pedía `kpi.section.<id>.*` y los locales publicaban `home.kpi.section.<id>.*`,
 * así que las 7 secciones salían con el fallback (mezcla de inglés e italiano)
 * en los cinco idiomas.
 *
 * Este check cierra ese hueco para el caso enumerable: los ids de sección
 * están declarados en `HOME_SECTIONS`, así que se extraen del catálogo y se
 * exige que las tres claves existan en cada locale que las deba servir.
 */
const CATALOG = join(ROOT, 'packages', 'platform', 'dashboard', 'home_kpi_catalog.ts');
const dynamicMissing: string[] = [];

function checkSectionKeys(): void {
  if (!existsSync(CATALOG)) return;
  const src = readFileSync(CATALOG, 'utf-8');
  // `id: 'morning',` dentro de HOME_SECTIONS.
  const ids = [...src.matchAll(/^\s{2}\{\s*$\n\s*id:\s*'([a-z_]+)'/gm)].map((m) => m[1]);
  if (!ids.length) return;

  // Los bundles de todos los módulos de una app se mergean en un único
  // diccionario (ver `deepMerge` en plugins/i18n.ts), así que la clave está
  // servida si CUALQUIER módulo la publica. Auditamos por app+idioma, no por
  // fichero: exigírsela a cada módulo daría falsos positivos en cargo/shipment,
  // que no declaran las secciones del cockpit.
  const byApp = new Map<string, Map<string, Set<string>>>();
  for (const dir of localeDirs()) {
    const app = rel(dir).split('/')[1] ?? rel(dir);
    for (const locale of SWITCHER_LOCALES) {
      const p = join(dir, `${locale}.json`);
      if (!existsSync(p)) continue;
      const keys = Object.keys(flatten(readJson(p)));
      if (!byApp.has(app)) byApp.set(app, new Map());
      const perLocale = byApp.get(app)!;
      if (!perLocale.has(locale)) perLocale.set(locale, new Set());
      const bag = perLocale.get(locale)!;
      for (const k of keys) if (k.startsWith('kpi.section.')) bag.add(k);
    }
  }

  for (const [app, perLocale] of byApp) {
    for (const [locale, bag] of perLocale) {
      // Solo las apps que sirven estas secciones entran en la auditoría.
      if (!bag.size) continue;
      for (const id of ids) {
        for (const sub of ['title', 'flow', 'list']) {
          const key = `kpi.section.${id}.${sub}`;
          if (!bag.has(key)) dynamicMissing.push(`${app}/${locale} :: ${key}`);
        }
      }
    }
  }
}
checkSectionKeys();

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const update = args.includes('--update');
const reportOnly = args.includes('--report');

const switcherIssues = checkSwitcher();
const stats = checkBundles();
const totals = stats.reduce(
  (a, s) => ({ missing: a.missing + s.missing, untranslated: a.untranslated + s.untranslated }),
  { missing: 0, untranslated: 0 },
);

interface Baseline { missing: number; untranslated: number; note?: string }
const baseline: Baseline = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline)
  : { missing: Number.MAX_SAFE_INTEGER, untranslated: Number.MAX_SAFE_INTEGER };

console.log('i18n gate\n=========');
console.log(`claves faltantes : ${totals.missing}  (baseline ${baseline.missing})`);
console.log(`sin traducir     : ${totals.untranslated}  (baseline ${baseline.untranslated})`);
console.log(`mojibake         : ${mojibake.length}  (debe ser 0)`);
console.log(`nombres de BD    : ${dbLeaks.length}  (debe ser 0)`);
console.log(`selector ↔ i18n  : ${switcherIssues.length} app(s) incoherentes (debe ser 0)`);
// El sufijo NO es decorativo: un 0 aquí se venía leyendo como "no hay texto
// hardcodeado", y este escaneo solo ve palabras italianas de una lista cerrada
// en líneas sin marcado. El recuento completo lo da `pnpm check:raw-text`.
console.log(
  `italiano hardcoded: ${hardcoded.length}  (debe ser 0 — parcial, ver 'pnpm check:raw-text')`,
);
console.log(`claves dinámicas : ${dynamicMissing.length}  (debe ser 0)`);

if (reportOnly) {
  console.log('\n--- por directorio ---');
  for (const s of stats.filter((x) => x.missing || x.untranslated)) {
    console.log(`  ${s.dir.padEnd(52)} faltan=${s.missing} sin_traducir=${s.untranslated}`);
  }
}
for (const m of mojibake.slice(0, 10)) console.log(`  MOJIBAKE ${m}`);
for (const d of dbLeaks.slice(0, 10)) console.log(`  DB_LEAK  ${d}`);
for (const h of hardcoded.slice(0, 15)) console.log(`  HARDCODE ${h}`);
for (const d of dynamicMissing.slice(0, 15)) console.log(`  DYNKEY   ${d}`);
for (const s of switcherIssues) {
  console.log(`  SWITCHER ${s.app}: ofrece [${s.offered.join(',')}] pero carga [${s.loaded.join(',')}] — falta [${s.missing.join(',')}]`);
}

if (update) {
  const next: Baseline = {
    missing: totals.missing,
    untranslated: totals.untranslated,
    note: 'Congelado por check_i18n.ts --update. Solo puede bajar: si sube, es regresión.',
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf-8');
  console.log(`\nBaseline actualizado -> ${rel(BASELINE_PATH)}`);
  process.exit(0);
}
if (reportOnly) process.exit(0);

const errors: string[] = [];
if (switcherIssues.length) errors.push(`${switcherIssues.length} app(s) ofrecen idiomas que no cargan`);
if (mojibake.length) errors.push(`${mojibake.length} cadena(s) con mojibake`);
if (dbLeaks.length) errors.push(`${dbLeaks.length} nombre(s) de BD como texto visible`);
if (hardcoded.length) errors.push(`${hardcoded.length} texto(s) italiano(s) hardcodeado(s) en templates`);
if (dynamicMissing.length) {
  errors.push(`${dynamicMissing.length} clave(s) dinámica(s) kpi.section.* que el código pide y el locale no publica`);
}
if (totals.missing > baseline.missing) {
  errors.push(`claves faltantes ${baseline.missing} -> ${totals.missing}`);
}
if (totals.untranslated > baseline.untranslated) {
  errors.push(`sin traducir ${baseline.untranslated} -> ${totals.untranslated}`);
}

if (errors.length) {
  console.error('\n✗ i18n gate FALLA:');
  for (const e of errors) console.error(`   - ${e}`);
  console.error('\nSi la subida es intencionada, ejecuta: pnpm check:i18n --update');
  process.exit(1);
}
console.log('\n✓ i18n gate OK — sin regresiones respecto al baseline.');
