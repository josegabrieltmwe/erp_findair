/**
 * Descripción de los campos de cada tabla de reglas fiscales para los
 * formularios, la tabla y la línea de tiempo de «Configuración fiscal».
 *
 * Los valores posibles de los enumerados NO se repiten aquí: llegan del
 * backend (`op=meta`, enums por tabla). Las etiquetas son claves i18n
 * `invoicing.fiscal.field.<key>`.
 */
import type { FiscRow, FiscTabla } from "../../services/fiscConfig.service";

export type FieldType =
  | "text"
  | "upper"
  | "iso"
  | "int"
  | "decimal"
  | "date"
  | "textarea"
  | "enum"
  | "sn"
  | "condition"
  | "voce"
  | "intermediario"
  | "regex";

export interface FieldDef {
  key: string;
  type: FieldType;
  required?: boolean;
  /** Admite valor vacío = «todos» (documento en canales y plazos). */
  allowEmpty?: boolean;
}

const VIGENCIA: FieldDef[] = [
  { key: "data_inizio", type: "date", required: true },
  { key: "data_fine", type: "date" },
];

/** Campos del alta, por tabla (en orden de formulario). */
export const TABLE_FIELDS: Record<FiscTabla, FieldDef[]> = {
  voci: [
    { key: "codice", type: "upper", required: true },
    { key: "tipo", type: "enum", required: true },
    { key: "ambito", type: "enum", required: true },
    { key: "base", type: "enum", required: true },
    { key: "orden_calculo", type: "int" },
    { key: "nome", type: "text", required: true },
    { key: "nome_EN", type: "text" },
    { key: "descrizione", type: "textarea" },
    ...VIGENCIA,
  ],
  valori: [
    { key: "id_voce", type: "voce", required: true },
    { key: "iso_paese", type: "iso" },
    { key: "id_partner", type: "int" },
    { key: "id_servizio", type: "int" },
    { key: "id_cliente", type: "int" },
    { key: "condicion", type: "condition", required: true },
    { key: "prioridad", type: "int" },
    { key: "valore_perc", type: "decimal" },
    { key: "valore_fisso", type: "decimal" },
    { key: "valore_min", type: "decimal" },
    { key: "valore_max", type: "decimal" },
    { key: "codigo_legal", type: "text" },
    { key: "rif_normativo", type: "text" },
    { key: "mencion_legal", type: "textarea" },
    { key: "descrizione", type: "textarea" },
    ...VIGENCIA,
  ],
  parametri: [
    { key: "chiave", type: "upper", required: true },
    { key: "voce", type: "upper" },
    { key: "iso_paese", type: "iso" },
    { key: "id_partner", type: "int" },
    { key: "valore", type: "text", required: true },
    { key: "descrizione", type: "textarea" },
    ...VIGENCIA,
  ],
  requisiti: [
    { key: "iso_paese", type: "iso", required: true },
    { key: "id_partner", type: "int" },
    { key: "documento", type: "enum", required: true },
    { key: "condicion", type: "condition", required: true },
    { key: "dato", type: "text", required: true },
    { key: "fuente", type: "enum", required: true },
    { key: "obligatorio", type: "sn", required: true },
    { key: "formato", type: "regex" },
    { key: "mensaje_error", type: "text" },
    { key: "base_legal", type: "text" },
    ...VIGENCIA,
  ],
  chiavi: [
    { key: "chiave", type: "upper", required: true },
    { key: "ambito", type: "enum", required: true },
    { key: "formato", type: "regex" },
    { key: "descrizione", type: "textarea" },
    ...VIGENCIA,
  ],
  canali: [
    { key: "iso_paese", type: "iso", required: true },
    { key: "id_partner", type: "int" },
    { key: "documento", type: "enum", allowEmpty: true },
    { key: "condicion", type: "condition", required: true },
    { key: "tipo", type: "enum", required: true },
    { key: "formato", type: "enum", required: true },
    { key: "id_intermediario", type: "intermediario", required: true },
    { key: "prioridad", type: "int", required: true },
    { key: "modo", type: "enum", required: true },
    ...VIGENCIA,
  ],
  intermediari: [],
  plazos: [
    { key: "iso_paese", type: "iso" },
    { key: "id_partner", type: "int" },
    { key: "documento", type: "enum", allowEmpty: true },
    { key: "caso", type: "enum", required: true },
    { key: "evento_inicio", type: "enum", required: true },
    { key: "dias", type: "int", required: true },
    { key: "tipo_dias", type: "enum", required: true },
    { key: "aviso_previo_dias", type: "int" },
    { key: "base_legal", type: "text" },
    { key: "descrizione", type: "textarea" },
    ...VIGENCIA,
  ],
};

/**
 * Identidad de la regla (SCOPE_FIELDS del modelo PHP): no cambia al
 * «Cambiar desde fecha»; la línea de tiempo agrupa por estos campos.
 */
export const SCOPE_FIELDS: Record<FiscTabla, string[]> = {
  voci: ["codice"],
  valori: [
    "id_voce",
    "iso_paese",
    "id_partner",
    "id_servizio",
    "id_cliente",
    "condicion",
  ],
  parametri: ["chiave", "voce", "iso_paese", "id_partner"],
  requisiti: ["iso_paese", "id_partner", "documento", "condicion", "dato"],
  chiavi: ["chiave"],
  canali: ["iso_paese", "id_partner", "documento", "condicion", "prioridad"],
  intermediari: ["codice"],
  plazos: ["iso_paese", "id_partner", "documento", "caso"],
};

/** Columnas de la vista de tabla (además de vigencia, situación y acciones). */
export const TABLE_COLUMNS: Record<FiscTabla, string[]> = {
  voci: [
    "codice",
    "tipo",
    "ambito",
    "base",
    "orden_calculo",
    "nome",
    "origen_valor",
  ],
  valori: [
    "voce_codice",
    "iso_paese",
    "id_partner",
    "id_servizio",
    "id_cliente",
    "condicion",
    "condicion_resumen",
    "valore_perc",
    "valore_fisso",
    "codigo_legal",
  ],
  parametri: ["chiave", "voce", "iso_paese", "id_partner", "valore"],
  requisiti: [
    "iso_paese",
    "id_partner",
    "documento",
    "condicion",
    "condicion_resumen",
    "dato",
    "fuente",
    "obligatorio",
    "formato",
  ],
  chiavi: ["chiave", "ambito", "formato", "descrizione"],
  canali: [
    "iso_paese",
    "id_partner",
    "documento",
    "condicion",
    "tipo",
    "formato",
    "intermediario_codice",
    "prioridad",
    "modo",
  ],
  intermediari: ["codice", "adaptador", "tipos_canal", "capacidades", "modo"],
  plazos: [
    "iso_paese",
    "id_partner",
    "documento",
    "caso",
    "evento_inicio",
    "dias",
    "tipo_dias",
    "aviso_previo_dias",
  ],
};

/** Catálogos de código único: se terminan, no se versionan. */
export const NOT_VERSIONED: FiscTabla[] = ["voci", "chiavi", "intermediari"];

/** Clave de la fila (id numérico o nombre de la clave en chiavi). */
export function rowKey(tabla: FiscTabla, row: FiscRow): number | string {
  return tabla === "chiavi" ? String(row.chiave ?? "") : Number(row.id ?? 0);
}

/** Decimal «22.0000» → «22». */
export function num(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return String(Number(n.toFixed(4)));
}

/** Resumen corto del valor de una fila (segmentos de la línea de tiempo). */
export function valueSummary(tabla: FiscTabla, row: FiscRow): string {
  switch (tabla) {
    case "valori": {
      const parts: string[] = [];
      if (
        row.valore_perc !== null &&
        row.valore_perc !== undefined &&
        row.valore_perc !== ""
      ) {
        parts.push(`${num(row.valore_perc)} %`);
      }
      if (
        row.valore_fisso !== null &&
        row.valore_fisso !== undefined &&
        row.valore_fisso !== ""
      ) {
        parts.push(num(row.valore_fisso));
      }
      return parts.join(" + ");
    }
    case "parametri":
      return String(row.valore ?? "");
    case "plazos":
      return `${String(row.dias ?? "")} ${String(row.tipo_dias ?? "").toLowerCase()}`;
    case "canali":
      return [row.tipo, row.formato, row.intermediario_codice]
        .filter(Boolean)
        .join(" · ");
    case "requisiti":
      return `${String(row.obligatorio ?? "")} ${String(row.formato ?? "")}`.trim();
    default:
      return String(row.nome ?? row.descrizione ?? "");
  }
}

/** Valor de una celda para mostrar: comodines legibles. */
/**
 * Descripción sin la coletilla técnica de la carga inicial («… Carga R2 desde
 * Country_Vat_Resolver::determine_de.»), que no dice nada al usuario.
 */
export function descripcionVisible(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(/\s*Carga R\d+ desde [^]*$/u, "")
    .trim();
}

export function cellText(
  key: string,
  value: unknown,
  allLabel: string,
): string {
  if (value === null || value === undefined) return "";
  if (
    ["id_partner", "id_servizio", "id_cliente"].includes(key) &&
    Number(value) === 0
  ) {
    return allLabel;
  }
  if (
    (key === "iso_paese" || key === "documento" || key === "voce") &&
    value === ""
  ) {
    return allLabel;
  }
  if (key.startsWith("valore_") && key !== "valore") return num(value);
  if (key === "descrizione") return descripcionVisible(String(value));
  return String(value);
}
