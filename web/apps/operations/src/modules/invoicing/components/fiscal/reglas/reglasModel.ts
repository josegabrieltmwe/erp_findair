/**
 * reglasModel — funciones puras del asistente de reglas fiscales (F6b):
 * formulario generado del esquema de la acción, resumen del ámbito, colores
 * de estado y errores por campo. Sin Vue ni red, para poder razonar sobre
 * ellas por separado.
 *
 * El esquema de una acción (`ReglaAccion.esquema`) es un objeto
 * parámetro → {tipo, obligatorio, etiquetas{es,it,en}, valores?, defecto?,
 * ayuda?} (Fisc_Action_Base::campo). El formulario no conoce ninguna acción
 * concreta: dibuja lo que dice el esquema.
 */
import type {
  ParamDef,
  Regla,
  ReglaAccion,
  ReglaEstado,
  ReglaInput,
} from "../../../services/fiscReglas.service";

/** Un parámetro del formulario ya ordenado y con su etiqueta en el idioma. */
export interface ParamField {
  key: string;
  def: ParamDef;
  label: string;
}

/** Grupo de textos por idioma (acción MENCION: texto_es, texto_it…). */
export interface TextoGroup {
  /** Idioma de la pestaña (es, it, en, de, nl). */
  lang: string;
  field: ParamField;
}

/** Idiomas de los textos legales, en el orden en que se muestran. */
export const IDIOMAS_TEXTO = ["es", "it", "en", "de", "nl"] as const;

/** Países ofrecidos en el ámbito (códigos ISO). El backend acepta cualquier ISO de 2 letras. */
export const PAISES = [
  "IT",
  "DE",
  "NL",
  "ES",
  "FR",
  "PT",
  "BE",
  "AT",
  "IE",
  "LU",
  "PL",
  "CH",
  "GB",
  "US",
] as const;

/** Color de Vuetify de cada estado de regla. */
export function estadoColor(estado: ReglaEstado | string): string {
  switch (estado) {
    case "ACTIVA":
      return "success";
    case "PENDIENTE":
      return "warning";
    case "CERRADA":
      return "grey";
    default:
      return "info";
  }
}

/** Etiqueta de un parámetro en el idioma pedido, con respaldo en inglés, español y la clave. */
export function paramLabel(key: string, def: ParamDef, lang: string): string {
  return def.etiquetas?.[lang] ?? def.etiquetas?.en ?? def.etiquetas?.es ?? key;
}

/**
 * Parámetros del esquema de una acción, con su etiqueta, obligatorios primero
 * (orden estable dentro de cada grupo).
 *
 * @param accion acción del catálogo (null = sin acción elegida)
 * @param lang idioma de las etiquetas
 * @returns lista vacía si la acción no tiene esquema
 */
export function paramFields(
  accion: ReglaAccion | null | undefined,
  lang: string,
): ParamField[] {
  const esquema = accion?.esquema;
  if (!esquema || Array.isArray(esquema)) return [];
  const out = Object.entries(esquema).map(([key, def]) => ({
    key,
    def,
    label: paramLabel(key, def, lang),
  }));
  return out
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        Number(b.f.def.obligatorio) - Number(a.f.def.obligatorio) || a.i - b.i,
    )
    .map((x) => x.f);
}

/** ¿Es un parámetro de texto por idioma (texto_es, texto_it…)? Devuelve el idioma o null. */
export function textoLang(key: string): string | null {
  const m = /^texto_([a-z]{2})$/.exec(key);
  return m && (IDIOMAS_TEXTO as readonly string[]).includes(m[1]!)
    ? m[1]!
    : null;
}

/** Separa los textos por idioma del resto de parámetros. */
export function splitTextos(fields: ParamField[]): {
  normales: ParamField[];
  textos: TextoGroup[];
} {
  const textos: TextoGroup[] = [];
  const normales: ParamField[] = [];
  for (const f of fields) {
    const lang = textoLang(f.key);
    if (lang) textos.push({ lang, field: f });
    else normales.push(f);
  }
  textos.sort(
    (a, b) =>
      IDIOMAS_TEXTO.indexOf(a.lang as (typeof IDIOMAS_TEXTO)[number]) -
      IDIOMAS_TEXTO.indexOf(b.lang as (typeof IDIOMAS_TEXTO)[number]),
  );
  return { normales, textos };
}

/**
 * Valores iniciales de los parámetros: el `defecto` del esquema si lo hay,
 * los booleanos a false y el resto vacío (el backend descarta los vacíos).
 */
export function defaultParams(
  accion: ReglaAccion | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of paramFields(accion, "es")) {
    if (f.def.defecto !== undefined) out[f.key] = f.def.defecto;
    else out[f.key] = f.def.tipo === "booleano" ? false : "";
  }
  return out;
}

/**
 * Parámetros listos para enviar: sin vacíos y con los números como número.
 *
 * @param accion acción cuyo esquema decide el tipo de cada parámetro
 * @param raw valores del formulario
 */
export function cleanParams(
  accion: ReglaAccion | null | undefined,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const esquema =
    accion?.esquema && !Array.isArray(accion.esquema) ? accion.esquema : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const def = esquema[k];
    if (
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "")
    )
      continue;
    if (def && (def.tipo === "decimal" || def.tipo === "entero")) {
      const n = Number(String(v).replace(",", "."));
      out[k] = Number.isFinite(n) ? n : v;
    } else if (def?.tipo === "pais") {
      out[k] = String(v).trim().toUpperCase();
    } else {
      out[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

/** Errores de parámetros (clave `parametros.x`) del detalle de un 422, por parámetro. */
export function paramErrors(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith("parametros.")) out[k.slice("parametros.".length)] = v;
  }
  return out;
}

/** Texto corto del ámbito de una regla («IT · P9069 · C77») o «Todos». */
export function ambitoText(
  r: Pick<Regla, "iso_paese" | "id_partner" | "id_servizio" | "id_cliente">,
  all: string,
): string {
  const parts = [
    r.iso_paese,
    r.id_partner ? `P${r.id_partner}` : "",
    r.id_servizio ? `S${r.id_servizio}` : "",
    r.id_cliente ? `C${r.id_cliente}` : "",
  ].filter((x) => x !== "");
  return parts.length ? parts.join(" · ") : all;
}

/** Estado vacío de una regla en el asistente. */
export function emptyRegla(
  hoy: string,
): Required<
  Pick<
    ReglaInput,
    | "etapa"
    | "accion"
    | "iso_paese"
    | "id_partner"
    | "id_servizio"
    | "id_cliente"
    | "prioridad"
    | "data_inizio"
    | "nombre"
    | "descrizione"
    | "rif_normativo"
  >
> & { data_fine: string; condicion: string | null } {
  return {
    etapa: "",
    accion: "",
    iso_paese: "",
    id_partner: 0,
    id_servizio: 0,
    id_cliente: 0,
    prioridad: 0,
    data_inizio: hoy,
    data_fine: "",
    nombre: "",
    descrizione: "",
    rif_normativo: "",
    condicion: null,
  };
}

/** Primer día y último día del mes anterior (Y-m-d), por defecto de la vista previa. */
export function lastMonth(now: Date = new Date()): [string, string] {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const f = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [f(first), f(last)];
}

/** Importe con dos decimales y signo opcional, para las tablas de la vista previa. */
export function money(v: number | null | undefined, signed = false): string {
  const n = Number(v ?? 0);
  const s = n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return signed && n > 0 ? `+${s}` : s;
}

/** Traductor de una clave con parámetros; null si la clave no existe en el idioma. */
export type Tr = (
  key: string,
  named?: Record<string, unknown>,
) => string | null;

/**
 * Resumen de la acción de una regla en el idioma de la interfaz
 * (`invoicing.fiscal.reglas.resumen.<ACCION>`), con los mismos datos que
 * Fisc_Rule_Explain_Service::item(). Devuelve `fallback` (el resumen del
 * backend) si la acción no tiene traducción o le falta un parámetro.
 */
export function resumenAccion(
  accion: string,
  params: Record<string, unknown> | null | undefined,
  lang: string,
  tr: Tr,
  fallback: string,
): string {
  const p = params ?? {};
  const s = (k: string): string => String(p[k] ?? "").trim();
  let named: Record<string, unknown> | null = null;
  switch (accion) {
    case "EXENCION":
    case "INVERSION_SUJETO_PASIVO":
      if (s("natura")) named = { accion, natura: s("natura").toUpperCase() };
      break;
    case "FIJAR_TIPO":
      if (s("tipo_perc")) named = { perc: s("tipo_perc") };
      break;
    case "ESIGIBILIDAD":
      if (s("codigo")) {
        const c = s("codigo").toUpperCase();
        return (
          tr(
            `invoicing.fiscal.reglas.resumen.ESIGIBILIDAD${c === "S" ? "_S" : ""}`,
            { codigo: c },
          ) ?? fallback
        );
      }
      break;
    case "AJUSTAR_PORCENTAJE": {
      const d = Number(p.delta_perc ?? NaN);
      if (s("concepto") && Number.isFinite(d)) {
        named = {
          concepto: s("concepto").toUpperCase(),
          delta: (d > 0 ? "+" : "") + String(d),
        };
      }
      break;
    }
    case "EXCLUIR_DE_BASE":
    case "INCLUIR_EN_BASE":
      if (s("componente"))
        named = { componente: s("componente").toUpperCase() };
      break;
    case "BOLLO":
      named = { importe: Number(p.importe ?? 2).toFixed(2) };
      break;
    case "RETENCION":
      if (s("tipo") && s("perc"))
        named = { tipo: s("tipo").toUpperCase(), perc: s("perc") };
      break;
    case "CARGO_FIJO":
      if (s("concepto")) named = { concepto: s("concepto") };
      break;
    case "MENCION": {
      const orden = [lang, "es", "it", "en", "de", "nl"];
      const texto =
        orden.map((l) => s(`texto_${l}`)).find((v) => v !== "") ?? "";
      if (texto)
        named = { texto: texto.length > 60 ? texto.slice(0, 59) + "…" : texto };
      break;
    }
  }
  if (named === null) return fallback;
  return tr(`invoicing.fiscal.reglas.resumen.${accion}`, named) ?? fallback;
}

/** Nombre de negocio de una acción (`acciones_nombre.<CODIGO>`); el código si no hay traducción. */
export function accionNombre(codigo: string, tr: Tr): string {
  return tr(`invoicing.fiscal.reglas.acciones_nombre.${codigo}`) ?? codigo;
}
