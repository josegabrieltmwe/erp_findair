import { createI18n } from "vue-i18n";

/** Deep-merge para bundles que comparten namespaces (cargo/shipment traen sus
 *  common/platform/listing propios; partner_clients y email_templates comparten
 *  `sections`/`selectors`). Fusiona objetos anidados; en hoja, el último gana.
 *
 *  El valor es recursivo (no `unknown`) para que el resultado siga encajando en
 *  el tipo LocaleMessage que espera createI18n. */
type DictValue = string | DictValue[] | { [k: string]: DictValue };
type Dict = { [k: string]: DictValue };
function deepMerge(...objs: Dict[]): Dict {
  const out: Dict = {};
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      const prev = out[k];
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        prev &&
        typeof prev === "object" &&
        !Array.isArray(prev)
      ) {
        out[k] = deepMerge(prev as Dict, v as Dict);
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

// Shell/transversal namespaces (common, errors, platform) viven en
// src/locales. Cada modulo trae su bundle ENVUELTO bajo su propia clave de
// dominio (p. ej. { tracking: {...} }) para que no choquen. Cargo y shipment se
// integraron "tal cual": traen sus locales completas (common/platform/listing
// propios) sin namespacing. Anadir un modulo = una entrada en BUNDLES (abajo).

export type AvailableLocale = "en" | "it" | "es" | "nl" | "de";

const AVAILABLE: readonly AvailableLocale[] = ["en", "it", "es", "nl", "de"];
function isLocale(v: unknown): v is AvailableLocale {
  return typeof v === "string" && (AVAILABLE as readonly string[]).includes(v);
}

/** ISO-3 (backend Locale_Registry) ↔ ISO-2 (vue-i18n). */
const ISO3_TO_ISO2: Record<string, AvailableLocale> = {
  ITA: "it",
  ENG: "en",
  SPA: "es",
  OLA: "nl",
  TED: "de",
};

export function toAvailableLocale(
  input: string | null | undefined,
): AvailableLocale {
  if (!input) return "en";
  const upper = input.toUpperCase();
  if (upper in ISO3_TO_ISO2) return ISO3_TO_ISO2[upper]!;
  const lower = input.toLowerCase();
  if (isLocale(lower)) return lower;
  return "en";
}

function resolveInitialLocale(): AvailableLocale {
  if (typeof localStorage !== "undefined") {
    const shared = localStorage.getItem("tmwe.locale");
    if (isLocale(shared)) return shared;
  }
  if (typeof window !== "undefined" && window.__TMWE_OPERATIONS__?.language) {
    return toAvailableLocale(window.__TMWE_OPERATIONS__.language);
  }
  if (typeof navigator !== "undefined") {
    const browser = navigator.language.slice(0, 2);
    if (isLocale(browser)) return browser;
  }
  return "en";
}

/**
 * Las páginas compartidas de `@shared/anagrafiche` piden sus claves SIN
 * prefijo de módulo (`t('anagrafiche.col_id')`), igual que en las apps
 * partner_clients y admin_config, donde ese bundle vive en la raíz. Aquí
 * llega envuelto en `{ partner_clients: {...} }`, así que sus 79 etiquetas
 * (incluidas las de los filtros) se quedaban sin resolver y la UI mostraba
 * la clave cruda.
 *
 * Se eleva el contenido del wrapper a la raíz y se conserva TAMBIÉN el
 * prefijo, por si algún consumidor local usa `partner_clients.*`. Es un
 * deepMerge, no un spread: `selectors` existe en dos módulos y un spread
 * plano haría que uno pisara al otro.
 */
function liftClients(bundle: Dict): Dict {
  const inner = bundle.partner_clients;
  if (!inner || typeof inner !== "object" || Array.isArray(inner))
    return bundle;
  return deepMerge(inner as Dict, bundle);
}

/**
 * Orden de fusion de los bundles de un idioma (shell + modulos). deepMerge, NO
 * spread plano: los dominios ya NO son disjuntos (partner_clients y
 * email_templates comparten `sections` y `selectors`); con `...` el ultimo
 * modulo reemplazaba el objeto entero del anterior. En un choque de hoja gana el
 * ultimo, en este orden.
 *
 * `lift`: el bundle de partner_clients se eleva tambien a la raiz (ver
 * liftClients).
 */
const BUNDLES: ReadonlyArray<{ dir: string; lift?: boolean }> = [
  { dir: "../locales" },
  { dir: "../modules/cargo/locales" },
  { dir: "../modules/shipment/locales" },
  { dir: "../modules/tracking/locales" },
  { dir: "../modules/giacenze/locales" },
  { dir: "../modules/consolidata/locales" },
  { dir: "../modules/partner_clients/locales", lift: true },
  { dir: "../modules/pickup/locales" },
  { dir: "../modules/crm/locales" },
  { dir: "../modules/copilot/locales" },
  { dir: "../modules/communication/locales" },
  { dir: "../modules/bulk/locales" },
  { dir: "../modules/settings/locales" },
  { dir: "../modules/invoicing/locales" },
  { dir: "../modules/payments/locales" },
  { dir: "../modules/warehouse/locales" },
  { dir: "../modules/proforma/locales" },
  { dir: "../modules/cod_assegni/locales" },
  { dir: "../modules/home/locales" },
  { dir: "../modules/email_templates/locales" },
];

/**
 * Carga perezosa: antes se importaban los 5 idiomas de los 20 bundles (100
 * JSON) en el arranque. Precompilados por @intlify/unplugin-vue-i18n ocupaban
 * ~5 MB por idioma (25 MB en `vite dev`, buena parte del app.js de 3,9 MB en el
 * build) aunque la sesion solo use uno. Ahora se carga el idioma activo y el de
 * reserva (en); el resto, nunca: el LanguageSwitcher recarga la pagina al
 * cambiar de idioma. En el build, los JSON de cada idioma van en un unico chunk
 * (`locale-<iso2>`, ver vite.config.ts).
 */
const LOADERS = import.meta.glob<Dict>(
  ["../locales/*.json", "../modules/*/locales/*.json"],
  { import: "default" },
);

const loaded = new Set<AvailableLocale>();

async function buildMessages(lang: AvailableLocale): Promise<Dict> {
  const bundles = await Promise.all(
    BUNDLES.map(async ({ dir, lift }) => {
      const load = LOADERS[`${dir}/${lang}.json`];
      if (!load) return {};
      const bundle = await load();
      return lift ? liftClients(bundle) : bundle;
    }),
  );
  return deepMerge(...bundles);
}

/** Carga (una sola vez) los mensajes de un idioma en la instancia global. */
export async function loadLocaleMessages(lang: AvailableLocale): Promise<void> {
  if (loaded.has(lang)) return;
  i18n.global.setLocaleMessage(lang, await buildMessages(lang));
  loaded.add(lang);
}

/**
 * Carga el idioma inicial y el de reserva. main.ts lo espera ANTES de importar
 * la app, para que ningun modulo se evalue con el catalogo vacio.
 */
export async function loadInitialLocales(): Promise<void> {
  const current = i18n.global.locale.value as AvailableLocale;
  await Promise.all([loadLocaleMessages(current), loadLocaleMessages("en")]);
}

// Los 5 idiomas se registran vacios desde el principio: `availableLocales`
// (de donde el LanguageSwitcher saca los idiomas que ofrece) sigue listandolos
// todos aunque solo se carguen el activo y el de reserva.
export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: "en",
  messages: Object.fromEntries(AVAILABLE.map((l) => [l, {}])) as Record<
    AvailableLocale,
    Dict
  >,
});
