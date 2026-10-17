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

// Shell/transversal namespaces (common, errors, platform) live once here.
import shellEn from "@/locales/en.json";
import shellEs from "@/locales/es.json";
import shellIt from "@/locales/it.json";
import shellNl from "@/locales/nl.json";
import shellDe from "@/locales/de.json";

// Per-module locale bundles. Each module ships its locale WRAPPED under its own
// domain key (e.g. { tracking: {...} }, { pickup: {...} }) so namespaces never
// collide between modules. Adding a module = 3 imports + 3 spreads below.
import trackingEn from "@/modules/tracking/locales/en.json";
import trackingEs from "@/modules/tracking/locales/es.json";
import trackingIt from "@/modules/tracking/locales/it.json";
import trackingNl from "@/modules/tracking/locales/nl.json";
import trackingDe from "@/modules/tracking/locales/de.json";
import consolidataEn from "@/modules/consolidata/locales/en.json";
import consolidataEs from "@/modules/consolidata/locales/es.json";
import consolidataIt from "@/modules/consolidata/locales/it.json";
import consolidataNl from "@/modules/consolidata/locales/nl.json";
import consolidataDe from "@/modules/consolidata/locales/de.json";
import giacenzeEn from "@/modules/giacenze/locales/en.json";
import giacenzeEs from "@/modules/giacenze/locales/es.json";
import giacenzeIt from "@/modules/giacenze/locales/it.json";
import giacenzeNl from "@/modules/giacenze/locales/nl.json";
import giacenzeDe from "@/modules/giacenze/locales/de.json";
import clientsEn from "@/modules/partner_clients/locales/en.json";
import clientsEs from "@/modules/partner_clients/locales/es.json";
import clientsIt from "@/modules/partner_clients/locales/it.json";
import clientsNl from "@/modules/partner_clients/locales/nl.json";
import clientsDe from "@/modules/partner_clients/locales/de.json";
import pickupEn from "@/modules/pickup/locales/en.json";
import pickupEs from "@/modules/pickup/locales/es.json";
import pickupIt from "@/modules/pickup/locales/it.json";
import pickupNl from "@/modules/pickup/locales/nl.json";
import pickupDe from "@/modules/pickup/locales/de.json";
import crmEn from "@/modules/crm/locales/en.json";
import crmEs from "@/modules/crm/locales/es.json";
import crmIt from "@/modules/crm/locales/it.json";
import crmNl from "@/modules/crm/locales/nl.json";
import crmDe from "@/modules/crm/locales/de.json";
import copilotEn from "@/modules/copilot/locales/en.json";
import copilotEs from "@/modules/copilot/locales/es.json";
import copilotIt from "@/modules/copilot/locales/it.json";
import copilotNl from "@/modules/copilot/locales/nl.json";
import copilotDe from "@/modules/copilot/locales/de.json";
import communicationEn from "@/modules/communication/locales/en.json";
import communicationEs from "@/modules/communication/locales/es.json";
import communicationIt from "@/modules/communication/locales/it.json";
import communicationNl from "@/modules/communication/locales/nl.json";
import communicationDe from "@/modules/communication/locales/de.json";
import bulkEn from "@/modules/bulk/locales/en.json";
import bulkEs from "@/modules/bulk/locales/es.json";
import bulkIt from "@/modules/bulk/locales/it.json";
import bulkNl from "@/modules/bulk/locales/nl.json";
import bulkDe from "@/modules/bulk/locales/de.json";
import settingsEn from "@/modules/settings/locales/en.json";
import settingsEs from "@/modules/settings/locales/es.json";
import settingsIt from "@/modules/settings/locales/it.json";
import settingsNl from "@/modules/settings/locales/nl.json";
import settingsDe from "@/modules/settings/locales/de.json";
import invoicingEn from "@/modules/invoicing/locales/en.json";
import paymentsEn from "@/modules/payments/locales/en.json";
import warehouseEn from "@/modules/warehouse/locales/en.json";
import invoicingEs from "@/modules/invoicing/locales/es.json";
import paymentsEs from "@/modules/payments/locales/es.json";
import warehouseEs from "@/modules/warehouse/locales/es.json";
import invoicingIt from "@/modules/invoicing/locales/it.json";
import paymentsIt from "@/modules/payments/locales/it.json";
import warehouseIt from "@/modules/warehouse/locales/it.json";
import invoicingNl from "@/modules/invoicing/locales/nl.json";
import paymentsNl from "@/modules/payments/locales/nl.json";
import warehouseNl from "@/modules/warehouse/locales/nl.json";
import invoicingDe from "@/modules/invoicing/locales/de.json";
import paymentsDe from "@/modules/payments/locales/de.json";
import warehouseDe from "@/modules/warehouse/locales/de.json";
import proformaEn from "@/modules/proforma/locales/en.json";
import proformaEs from "@/modules/proforma/locales/es.json";
import proformaIt from "@/modules/proforma/locales/it.json";
import proformaNl from "@/modules/proforma/locales/nl.json";
import proformaDe from "@/modules/proforma/locales/de.json";
import codEn from "@/modules/cod_assegni/locales/en.json";
import codEs from "@/modules/cod_assegni/locales/es.json";
import codIt from "@/modules/cod_assegni/locales/it.json";
import codNl from "@/modules/cod_assegni/locales/nl.json";
import codDe from "@/modules/cod_assegni/locales/de.json";
import homeEn from "@/modules/home/locales/en.json";
import homeEs from "@/modules/home/locales/es.json";
import homeIt from "@/modules/home/locales/it.json";
import homeNl from "@/modules/home/locales/nl.json";
import homeDe from "@/modules/home/locales/de.json";
import emailTplEn from "@/modules/email_templates/locales/en.json";
import emailTplEs from "@/modules/email_templates/locales/es.json";
import emailTplIt from "@/modules/email_templates/locales/it.json";
import emailTplNl from "@/modules/email_templates/locales/nl.json";
import emailTplDe from "@/modules/email_templates/locales/de.json";
// Cargo integrado "tal cual": trae sus locales completas (incluye common/
// platform/listing propios) sin namespacing — sus pages dependen de ellas.
import cargoEn from "@cargo/locales/en.json";
import cargoEs from "@cargo/locales/es.json";
import cargoIt from "@cargo/locales/it.json";
import cargoNl from "@cargo/locales/nl.json";
import cargoDe from "@cargo/locales/de.json";
import shipmentEn from "@shipment/locales/en.json";
import shipmentEs from "@shipment/locales/es.json";
import shipmentIt from "@shipment/locales/it.json";
import shipmentNl from "@shipment/locales/nl.json";
import shipmentDe from "@shipment/locales/de.json";

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

// Merge shell + every module bundle per language.
//
// deepMerge, NO spread plano: los dominios ya NO son disjuntos (partner_clients
// y email_templates comparten `sections` y `selectors`). Con `...` el último
// módulo REEMPLAZABA el objeto entero del anterior — por eso se perdía
// `sections.anagrafiche` (título del listado de clientes), que email_templates
// pisaba con su propio `sections`. El orden se mantiene: en un choque de hoja,
// gana el último, igual que antes.
const messages = {
  en: deepMerge(
    shellEn,
    cargoEn,
    shipmentEn,
    trackingEn,
    giacenzeEn,
    consolidataEn,
    liftClients(clientsEn),
    pickupEn,
    crmEn,
    copilotEn,
    communicationEn,
    bulkEn,
    settingsEn,
    invoicingEn,
    paymentsEn,
    warehouseEn,
    proformaEn,
    codEn,
    homeEn,
    emailTplEn,
  ),
  es: deepMerge(
    shellEs,
    cargoEs,
    shipmentEs,
    trackingEs,
    giacenzeEs,
    consolidataEs,
    liftClients(clientsEs),
    pickupEs,
    crmEs,
    copilotEs,
    communicationEs,
    bulkEs,
    settingsEs,
    invoicingEs,
    paymentsEs,
    warehouseEs,
    proformaEs,
    codEs,
    homeEs,
    emailTplEs,
  ),
  it: deepMerge(
    shellIt,
    cargoIt,
    shipmentIt,
    trackingIt,
    giacenzeIt,
    consolidataIt,
    liftClients(clientsIt),
    pickupIt,
    crmIt,
    copilotIt,
    communicationIt,
    bulkIt,
    settingsIt,
    invoicingIt,
    paymentsIt,
    warehouseIt,
    proformaIt,
    codIt,
    homeIt,
    emailTplIt,
  ),
  // NL/DE completos: shell + los 15 módulos tienen bundle propio. Lo que no
  // se pudo traducir (siglas y etiquetas que ya estaban en inglés en el
  // bundle italiano de origen) quedó con su valor inglés, nunca italiano.
  nl: deepMerge(
    shellNl,
    cargoNl,
    shipmentNl,
    trackingNl,
    giacenzeNl,
    consolidataNl,
    liftClients(clientsNl),
    pickupNl,
    crmNl,
    copilotNl,
    communicationNl,
    bulkNl,
    settingsNl,
    invoicingNl,
    paymentsNl,
    warehouseNl,
    proformaNl,
    codNl,
    homeNl,
    emailTplNl,
  ),
  de: deepMerge(
    shellDe,
    cargoDe,
    shipmentDe,
    trackingDe,
    giacenzeDe,
    consolidataDe,
    liftClients(clientsDe),
    pickupDe,
    crmDe,
    copilotDe,
    communicationDe,
    bulkDe,
    settingsDe,
    invoicingDe,
    paymentsDe,
    warehouseDe,
    proformaDe,
    codDe,
    homeDe,
    emailTplDe,
  ),
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: "en",
  messages,
});
