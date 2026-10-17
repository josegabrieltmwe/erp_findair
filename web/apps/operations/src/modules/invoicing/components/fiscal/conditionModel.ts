/**
 * conditionModel — lógica pura (sin Vue) del constructor visual de condiciones
 * de las reglas fiscales (REGLAS_DINAMICAS §3.2 y §3.3).
 *
 * Qué hace: convierte entre el JSON de `condicion_json` y un árbol editable,
 * valida en cliente con los MISMOS tipos, operadores y etapas del catálogo que
 * entrega `GET api_fisc_config?op=catalogo` (el backend valida igualmente, es
 * la autoridad), decide qué datos se ofrecen en cada etapa, traduce los atajos
 * actuales (NACIONAL, CLASE:21, RUTA:…) a texto legible o a filas equivalentes
 * y resume una condición en una frase.
 *
 * Formato del JSON (igual que Fisc_Condition_Compiler):
 *   {"todas":[{"dato":"cliente.es_pa","op":"es","valor":true},
 *             {"cualquiera":[{"dato":"factura.total_imponible","op":">","valor":0}]}]}
 *
 * Ejemplo:
 *   const root = parseCondition(row.condicion_json);          // árbol o null
 *   const errors = validateCondition(root!, catalogo, "IMPUESTOS");
 *   const json = serializeCondition(root!);                   // texto para guardar
 *   summarizeCondition(json, catalogo, { t, lang: "es" });    // «Cliente es PA y …»
 */
import type {
  FiscCatalogo,
  FiscDato,
  FiscTabla,
  FiscTipoDato,
} from "../../services/fiscConfig.service";

export type GroupMode = "todas" | "cualquiera";

/** Fila «dato · operador · valor». `valor` es null/array/escalar según el operador. */
export interface CondLeaf {
  kind: "leaf";
  dato: string;
  op: string;
  valor: unknown;
}

/** Grupo «todas» (Y) o «cualquiera» (O) con filas y, en el raíz, un nivel de subgrupos. */
export interface CondGroup {
  kind: "group";
  mode: GroupMode;
  items: CondNode[];
}

export type CondNode = CondLeaf | CondGroup;

/** Error de validación en cliente: `code` es la clave `invoicing.fiscal.cond.err.<code>`. */
export interface CondError {
  code: string;
  /** Ruta legible de la fila, p. ej. «1.2». */
  path: string;
  params?: Record<string, string | number>;
}

/** Función de traducción mínima (vue-i18n `t`). */
export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;

/** Operadores que no llevan valor. */
export const OPS_SIN_VALOR = ["vacio", "no_vacio"];

/** Operadores de comparación y su símbolo. */
const OP_SYMBOL: Record<string, string> = {
  ">": ">",
  ">=": "≥",
  "<": "<",
  "<=": "≤",
};

/** Patrón de la clave de un parámetro (igual que PHP). */
export const PARAM_KEY_PATTERN = /^[A-Z0-9][A-Z0-9_.]{1,63}$/;
/** Natura admitida en `factura.total_por_natura[...]`. */
export const NATURA_PATTERN = /^(N[1-7](\.[1-6])?|AE)$/;
/** Naturas ofrecidas en el selector. */
export const NATURAS = [
  "N1",
  "N2.1",
  "N2.2",
  "N3.1",
  "N3.2",
  "N3.3",
  "N3.4",
  "N3.5",
  "N3.6",
  "N4",
  "N5",
  "N6.1",
  "N6.2",
  "N6.3",
  "N6.4",
  "N6.5",
  "N6.6",
  "N6.7",
  "N6.8",
  "N6.9",
  "N7",
  "AE",
];

const PARAM_PREFIX = "param.";
const NATURA_RE = /^factura\.total_por_natura\[([^\]]*)\]$/;

// ── Etapa de una regla ───────────────────────────────────────────────

/**
 * Etapa del pipeline de una regla (espejo de Fisc_Rule_Index::stage_of_voce y
 * de Fisc_Config_Service::stage_of_rule).
 *
 * @param tabla `valori` o `requisiti` (otra tabla no tiene etapa)
 * @param voce  concepto de la regla (tipo y ámbito) para `valori`
 * @returns IMPUESTOS (tipo IVA), FACTURA (ámbito FACTURA), RECARGOS (resto),
 *          VALIDACION (requisitos) o null si no se puede saber
 */
export function stageOfRule(
  tabla: FiscTabla,
  voce?: { tipo?: string; ambito?: string } | null,
): string | null {
  if (tabla === "requisiti") return "VALIDACION";
  if (tabla !== "valori" || !voce) return null;
  if (String(voce.tipo ?? "").toUpperCase() === "IVA") return "IMPUESTOS";
  if (String(voce.ambito ?? "").toUpperCase() === "FACTURA") return "FACTURA";
  return "RECARGOS";
}

// ── Catálogo: datos disponibles ──────────────────────────────────────

/** Entrada sintética del selector para datos con parte libre. */
export interface DatoOption {
  /** Clave del catálogo o `param.*` / `factura.total_por_natura[*]`. */
  value: string;
  title: string;
  dato: FiscDato;
}

/**
 * ¿El dato está disponible en la etapa? (espejo de Fisc_Fact_Catalog::available_at)
 *
 * @param dato     definición del catálogo
 * @param stage    etapa de la regla; null = sin filtro
 * @param catalogo catálogo (orden y tipo de ejecución de las etapas)
 * @returns false si la etapa es anterior a la mínima del dato o su ámbito no corresponde
 */
export function isAvailableAt(
  dato: FiscDato,
  stage: string | null,
  catalogo: FiscCatalogo,
): boolean {
  if (!stage) return true;
  const cur = catalogo.etapas.find((e) => e.etapa === stage);
  const min = catalogo.etapas.find((e) => e.etapa === dato.etapa_minima);
  if (!cur || !min) return false;
  if (cur.orden < min.orden) return false;
  if (dato.ambito === "FACTURA" && cur.por_expedicion) return false;
  if (dato.ambito === "EXPEDICION" && !cur.por_expedicion) return false;
  return true;
}

/** Etiqueta del dato en el idioma (es/it/en; de y nl usan en). */
export function datoLabel(dato: FiscDato, lang: string): string {
  return dato.etiquetas[lang] ?? dato.etiquetas.en ?? dato.clave;
}

/** Definición virtual de `param.<CLAVE>` (texto, desde CONTEXTO, ambos ámbitos). */
function paramDato(): FiscDato {
  return {
    clave: PARAM_PREFIX + "*",
    tipo: "texto",
    etapa_minima: "CONTEXTO",
    ambito: "AMBOS",
    operadores: [
      "es",
      "no_es",
      "en",
      "no_en",
      "empieza_por",
      "vacio",
      "no_vacio",
    ],
    etiquetas: {},
    origen: "fisc_parametri",
    pendiente: false,
  };
}

/** Definición virtual de `factura.total_por_natura[Nx]` (decimal, desde FACTURA). */
function naturaDato(tipos: Record<string, string[]>): FiscDato {
  return {
    clave: "factura.total_por_natura[*]",
    tipo: "decimal",
    etapa_minima: "FACTURA",
    ambito: "FACTURA",
    operadores: tipos.decimal ?? [],
    etiquetas: {},
    origen: null,
    pendiente: false,
  };
}

/**
 * Datos que se ofrecen en una etapa, ordenados por grupo y etiqueta, con los
 * dos datos de clave libre (parámetro y total por Natura) al final.
 *
 * @param catalogo catálogo de `op=catalogo`
 * @param stage    etapa de la regla (null = todos)
 * @param lang     idioma de las etiquetas
 * @param t        traducción (para «Parámetro…» y «Total con Natura…»)
 * @returns opciones para el selector «dato»
 */
export function datoOptions(
  catalogo: FiscCatalogo,
  stage: string | null,
  lang: string,
  t: Translate,
): DatoOption[] {
  const out: DatoOption[] = catalogo.datos
    .filter((d) => isAvailableAt(d, stage, catalogo))
    .map((d) => ({
      value: d.clave,
      title: datoLabel(d, lang) + (d.pendiente ? " ⚠" : ""),
      dato: d,
    }));
  const p = paramDato();
  if (isAvailableAt(p, stage, catalogo)) {
    out.push({
      value: p.clave,
      title: t("invoicing.fiscal.cond.param_dato"),
      dato: p,
    });
  }
  const n = naturaDato(catalogo.tipos);
  if (isAvailableAt(n, stage, catalogo)) {
    out.push({
      value: n.clave,
      title: t("invoicing.fiscal.cond.natura_dato"),
      dato: n,
    });
  }
  return out;
}

/**
 * Valor del selector «dato» para una clave guardada (`param.X` → `param.*`).
 *
 * @param dato clave completa de la fila
 */
export function datoSelectValue(dato: string): string {
  if (dato.startsWith(PARAM_PREFIX)) return PARAM_PREFIX + "*";
  if (NATURA_RE.test(dato)) return "factura.total_por_natura[*]";
  return dato;
}

/**
 * Parte libre de una clave: la CLAVE de `param.CLAVE` o la Natura de
 * `factura.total_por_natura[Nx]`; cadena vacía si el dato no la tiene.
 */
export function datoFreePart(dato: string): string {
  if (dato.startsWith(PARAM_PREFIX)) return dato.slice(PARAM_PREFIX.length);
  const m = NATURA_RE.exec(dato);
  return m ? m[1] : "";
}

/**
 * Compone la clave completa a partir de la opción elegida y su parte libre.
 *
 * @param select valor del selector (`param.*`, `factura.total_por_natura[*]` o clave fija)
 * @param free   CLAVE o Natura escrita por el usuario
 */
export function composeDato(select: string, free: string): string {
  if (select === PARAM_PREFIX + "*") return PARAM_PREFIX + free;
  if (select === "factura.total_por_natura[*]") {
    return "factura.total_por_natura[" + free + "]";
  }
  return select;
}

/**
 * Definición de un dato por su clave completa (incluidos `param.*` y natura).
 *
 * @returns la definición o undefined si la clave no existe en el catálogo
 */
export function findDato(
  dato: string,
  catalogo: FiscCatalogo,
): FiscDato | undefined {
  const fixed = catalogo.datos.find((d) => d.clave === dato);
  if (fixed) return fixed;
  if (dato.startsWith(PARAM_PREFIX)) {
    return PARAM_KEY_PATTERN.test(dato.slice(PARAM_PREFIX.length))
      ? paramDato()
      : undefined;
  }
  const m = NATURA_RE.exec(dato);
  if (m && NATURA_PATTERN.test(m[1])) return naturaDato(catalogo.tipos);
  return undefined;
}

// ── Valores por defecto y forma según operador ───────────────────────

/**
 * Valor inicial de una fila según tipo y operador.
 *
 * @param tipo tipo del dato
 * @param op   operador elegido
 * @returns null (sin valor), lista vacía (en/no_en), par (entre) o escalar vacío
 */
export function defaultValue(tipo: FiscTipoDato, op: string): unknown {
  if (OPS_SIN_VALOR.includes(op)) return null;
  if (op === "en" || op === "no_en") return [];
  if (op === "entre") return [null, null];
  switch (tipo) {
    case "booleano":
      return true;
    case "entero":
    case "decimal":
      return null;
    default:
      return "";
  }
}

/** Fila nueva con el primer dato disponible y su primer operador. */
export function newLeaf(option: DatoOption): CondLeaf {
  const op = option.dato.operadores[0] ?? "es";
  return {
    kind: "leaf",
    dato: option.value,
    op,
    valor: defaultValue(option.dato.tipo, op),
  };
}

/** Grupo vacío del modo indicado. */
export function newGroup(mode: GroupMode = "todas"): CondGroup {
  return { kind: "group", mode, items: [] };
}

// ── JSON ⇄ árbol ─────────────────────────────────────────────────────

function toNode(raw: unknown): CondNode | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const obj = raw as Record<string, unknown>;
  for (const mode of ["todas", "cualquiera"] as const) {
    if (mode in obj) {
      const list = obj[mode];
      if (!Array.isArray(list)) return null;
      const items: CondNode[] = [];
      for (const it of list) {
        const n = toNode(it);
        if (n === null) return null;
        items.push(n);
      }
      return { kind: "group", mode, items };
    }
  }
  if (typeof obj.dato !== "string" || typeof obj.op !== "string") return null;
  return {
    kind: "leaf",
    dato: obj.dato,
    op: obj.op,
    valor: obj.valor === undefined ? null : obj.valor,
  };
}

/**
 * Lee el texto de `condicion_json` como árbol editable.
 *
 * @param json texto JSON (o null/vacío)
 * @returns el grupo raíz; un grupo «todas» vacío si no hay JSON; null si el
 *          texto no es JSON o no tiene la forma esperada (no editable en visual)
 */
export function parseCondition(
  json: string | null | undefined,
): CondGroup | null {
  if (json === null || json === undefined || json.trim() === "") {
    return newGroup("todas");
  }
  try {
    const node = toNode(JSON.parse(json));
    return node !== null && node.kind === "group" ? node : null;
  } catch {
    return null;
  }
}

function leafToJson(l: CondLeaf): Record<string, unknown> {
  const out: Record<string, unknown> = { dato: l.dato, op: l.op };
  if (!OPS_SIN_VALOR.includes(l.op)) out.valor = l.valor;
  return out;
}

function nodeToJson(n: CondNode): unknown {
  if (n.kind === "leaf") return leafToJson(n);
  return { [n.mode]: n.items.map(nodeToJson) };
}

/**
 * Serializa el árbol al JSON que guarda `condicion_json`.
 *
 * @param root grupo raíz
 * @returns texto JSON, o null si el árbol no tiene ninguna fila (= sin condición JSON)
 */
export function serializeCondition(root: CondGroup): string | null {
  if (root.items.length === 0) return null;
  return JSON.stringify(nodeToJson(root));
}

/** Número de filas (hojas) del árbol. */
export function countLeaves(node: CondNode): number {
  return node.kind === "leaf"
    ? 1
    : node.items.reduce((n, c) => n + countLeaves(c), 0);
}

// ── Validación en cliente ────────────────────────────────────────────

function scalarOk(tipo: FiscTipoDato, v: unknown): boolean {
  switch (tipo) {
    case "texto":
    case "lista":
      return typeof v === "string" && v.trim() !== "";
    case "pais":
      return typeof v === "string" && /^[A-Za-z]{2}$/.test(v);
    case "entero":
      return typeof v === "number" && Number.isInteger(v);
    case "decimal":
      return typeof v === "number" && Number.isFinite(v);
    case "booleano":
      return typeof v === "boolean";
    case "fecha": {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const d = new Date(v + "T00:00:00Z");
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }
  }
  return false;
}

function validateLeaf(
  l: CondLeaf,
  catalogo: FiscCatalogo,
  stage: string | null,
  path: string,
  errors: CondError[],
): void {
  if (!l.dato) {
    errors.push({ code: "no_dato", path });
    return;
  }
  const def = findDato(l.dato, catalogo);
  if (!def) {
    errors.push({ code: "unknown_dato", path, params: { dato: l.dato } });
    return;
  }
  if (
    l.dato.startsWith(PARAM_PREFIX) &&
    !PARAM_KEY_PATTERN.test(datoFreePart(l.dato))
  ) {
    errors.push({ code: "param_key", path });
  }
  if (!isAvailableAt(def, stage, catalogo)) {
    errors.push({
      code: "unavailable",
      path,
      params: { dato: l.dato, etapa: stage ?? "" },
    });
  }
  if (!def.operadores.includes(l.op)) {
    errors.push({
      code: "op_invalid",
      path,
      params: { op: l.op, tipo: def.tipo },
    });
    return;
  }
  if (OPS_SIN_VALOR.includes(l.op)) return;
  const tipo: FiscTipoDato = def.tipo === "lista" ? "texto" : def.tipo;
  const v = l.valor;
  if (l.op === "en" || l.op === "no_en") {
    if (!Array.isArray(v) || v.length === 0) {
      errors.push({ code: "list_empty", path });
    } else if (!v.every((x) => scalarOk(tipo, x))) {
      errors.push({ code: "value_type", path, params: { tipo } });
    }
    return;
  }
  if (l.op === "entre") {
    if (
      !Array.isArray(v) ||
      v.length !== 2 ||
      !v.every((x) => scalarOk(tipo, x))
    ) {
      errors.push({ code: "between_pair", path });
    } else if ((v[0] as number | string) > (v[1] as number | string)) {
      errors.push({ code: "between_order", path });
    }
    return;
  }
  if (!scalarOk(tipo, v)) {
    errors.push({
      code: v === null || v === "" ? "value_missing" : "value_type",
      path,
      params: { tipo },
    });
  }
}

function validateNode(
  n: CondNode,
  depth: number,
  catalogo: FiscCatalogo,
  stage: string | null,
  path: string,
  errors: CondError[],
): void {
  if (n.kind === "leaf") {
    validateLeaf(n, catalogo, stage, path, errors);
    return;
  }
  if (depth > catalogo.max_anidamiento) {
    errors.push({
      code: "depth",
      path,
      params: { max: catalogo.max_anidamiento },
    });
    return;
  }
  if (n.items.length === 0) {
    errors.push({ code: "empty_group", path });
    return;
  }
  n.items.forEach((c, i) =>
    validateNode(
      c,
      depth + 1,
      catalogo,
      stage,
      path === "" ? String(i + 1) : `${path}.${i + 1}`,
      errors,
    ),
  );
}

/**
 * Valida el árbol con las mismas reglas que Fisc_Condition_Compiler::validate:
 * el dato existe y está disponible en la etapa, el operador es válido para su
 * tipo, el valor tiene el tipo correcto y el anidamiento no pasa del máximo.
 *
 * @param root     grupo raíz
 * @param catalogo catálogo de `op=catalogo`
 * @param stage    etapa de la regla (null = no se comprueba disponibilidad)
 * @returns errores (vacío si es válido); un árbol sin filas es válido (= sin condición)
 */
export function validateCondition(
  root: CondGroup,
  catalogo: FiscCatalogo,
  stage: string | null,
): CondError[] {
  const errors: CondError[] = [];
  if (root.items.length === 0) return errors;
  root.items.forEach((c, i) =>
    validateNode(c, 2, catalogo, stage, String(i + 1), errors),
  );
  return errors;
}

// ── Atajos ───────────────────────────────────────────────────────────

/** Fila equivalente a un atajo (sin `kind`). */
export interface AtajoRow {
  dato: string;
  op: string;
  valor: unknown;
}

/**
 * Atajos con equivalente EXACTO en filas del constructor. NACIONAL,
 * INTRA_UE_*, EXTRA_UE y RUTA: comparan dos datos entre sí o usan la lista UE
 * y no se pueden escribir como «dato · operador · valor»: siguen en el campo
 * de texto de atajos.
 */
export const ATAJO_ROWS: Record<string, AtajoRow[]> = {
  B2B: [
    { dato: "cliente.tiene_vat", op: "es", valor: true },
    { dato: "cliente.es_pa", op: "es", valor: false },
  ],
  B2C: [
    { dato: "cliente.tiene_vat", op: "es", valor: false },
    { dato: "cliente.es_pa", op: "es", valor: false },
  ],
  PA: [{ dato: "cliente.es_pa", op: "es", valor: true }],
  B2G: [{ dato: "cliente.es_pa", op: "es", valor: true }],
  EXPORT_ART9: [{ dato: "ruta.export_art9", op: "es", valor: true }],
  LETTERA_INTENTO: [{ dato: "cliente.carta_intencion", op: "es", valor: true }],
  EXPRESS: [{ dato: "expedicion.tipo", op: "es", valor: "EXPRESS" }],
  CARGO: [{ dato: "expedicion.tipo", op: "es", valor: "CARGO" }],
  DOMESTICA: [{ dato: "ruta.domestica", op: "es", valor: true }],
  "CLASE:21": [{ dato: "cliente.clase_iva", op: "es", valor: "21" }],
};

/** Atajos que se muestran como chips (con equivalente o sin él). */
export const ATAJO_CHIPS = [
  "NACIONAL",
  "INTRA_UE_B2B",
  "INTRA_UE_B2C",
  "EXTRA_UE",
  "B2B",
  "B2C",
  "PA",
  "EXPORT_ART9",
  "LETTERA_INTENTO",
  "EXPRESS",
  "CARGO",
  "DOMESTICA",
  "CLASE:21",
];

/**
 * Explicación legible de un atajo o de una composición («A&B», «!A»).
 *
 * @param code texto de la columna `condicion`
 * @param t    traducción
 * @returns frase en el idioma activo; el propio código si no se reconoce
 */
export function explainAtajo(code: string, t: Translate): string {
  const text = code.trim();
  if (text.includes("&")) {
    return text
      .split("&")
      .map((p) => explainAtajo(p, t))
      .join(` ${t("invoicing.fiscal.cond.y")} `);
  }
  if (text.startsWith("!")) {
    return t("invoicing.fiscal.cond.atajo.NOT", {
      x: explainAtajo(text.slice(1), t),
    });
  }
  const upper = text.toUpperCase();
  if (upper.startsWith("CLASE:")) {
    return t("invoicing.fiscal.cond.atajo.CLASE", { x: text.slice(6) });
  }
  if (upper.startsWith("RUTA:")) {
    return t("invoicing.fiscal.cond.atajo.RUTA", { x: text.slice(5) });
  }
  if (upper.startsWith("PARAM:")) {
    const [k, v] = text.slice(6).split("=");
    return t("invoicing.fiscal.cond.atajo.PARAM", { k: k ?? "", v: v ?? "" });
  }
  const key = `invoicing.fiscal.cond.atajo.${upper}`;
  const out = t(key);
  return out === key ? text : out;
}

// ── Resumen legible ──────────────────────────────────────────────────

function valueText(
  tipo: FiscTipoDato | undefined,
  v: unknown,
  t: Translate,
): string {
  if (Array.isArray(v)) return v.map((x) => valueText(tipo, x, t)).join(", ");
  if (typeof v === "boolean") {
    return t(v ? "invoicing.fiscal.cond.yes" : "invoicing.fiscal.cond.no");
  }
  if (v === null || v === undefined) return "…";
  return String(v);
}

function nodeSummary(
  n: unknown,
  catalogo: FiscCatalogo | null,
  ctx: { t: Translate; lang: string },
  nested: boolean,
): string {
  const { t, lang } = ctx;
  if (typeof n !== "object" || n === null) return "";
  const obj = n as Record<string, unknown>;
  for (const mode of ["todas", "cualquiera"] as const) {
    if (Array.isArray(obj[mode])) {
      const sep = ` ${t(mode === "todas" ? "invoicing.fiscal.cond.y" : "invoicing.fiscal.cond.o")} `;
      const txt = (obj[mode] as unknown[])
        .map((c) => nodeSummary(c, catalogo, ctx, true))
        .filter((s) => s !== "")
        .join(sep);
      return nested && (obj[mode] as unknown[]).length > 1 ? `(${txt})` : txt;
    }
  }
  const dato = String(obj.dato ?? "");
  const op = String(obj.op ?? "");
  const def = catalogo ? findDato(dato, catalogo) : undefined;
  let label = def && def.etiquetas.en ? datoLabel(def, lang) : dato;
  if (dato.startsWith(PARAM_PREFIX)) {
    label = t("invoicing.fiscal.cond.param_label", { k: datoFreePart(dato) });
  } else if (NATURA_RE.test(dato)) {
    label = t("invoicing.fiscal.cond.natura_label", { k: datoFreePart(dato) });
  }
  if (def?.tipo === "booleano" && (op === "es" || op === "no_es")) {
    const val =
      obj.valor === true ? op === "es" : op === "no_es" ? true : false;
    return `${label}: ${t(val ? "invoicing.fiscal.cond.yes" : "invoicing.fiscal.cond.no")}`;
  }
  if (OPS_SIN_VALOR.includes(op)) {
    return `${label} ${t(`invoicing.fiscal.cond.op.${op}`)}`;
  }
  const opText = OP_SYMBOL[op] ?? t(`invoicing.fiscal.cond.op.${op}`);
  if (op === "entre" && Array.isArray(obj.valor)) {
    return `${label} ${opText} ${valueText(def?.tipo, obj.valor[0], t)} ${t("invoicing.fiscal.cond.y")} ${valueText(def?.tipo, obj.valor[1], t)}`;
  }
  return `${label} ${opText} ${valueText(def?.tipo, obj.valor, t)}`;
}

/**
 * Resume una condición en una frase legible («Cliente Administración pública:
 * sí y Total imponible > 0»). Acepta el JSON o un atajo/composición de atajos.
 *
 * @param source   `condicion_json` o `condicion`
 * @param catalogo catálogo (etiquetas); null = se muestran las claves
 * @param ctx      traducción e idioma de las etiquetas
 * @returns texto; cadena vacía si no hay condición
 */
export function summarizeCondition(
  source: string | null | undefined,
  catalogo: FiscCatalogo | null,
  ctx: { t: Translate; lang: string },
): string {
  const text = (source ?? "").trim();
  if (text === "") return "";
  if (text.startsWith("{")) {
    try {
      return nodeSummary(JSON.parse(text), catalogo, ctx, false);
    } catch {
      return text;
    }
  }
  if (text.startsWith("JSON:")) return ""; // marcador: el texto legible sale de condicion_json
  return explainAtajo(text, ctx.t);
}
