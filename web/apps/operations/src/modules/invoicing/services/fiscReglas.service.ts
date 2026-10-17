/**
 * fiscReglas.service — reglas fiscales configurables (REGLAS_DINAMICAS §3.8,
 * F6b). Consume `api_fisc_reglas` (Web_Fisc_Reglas_Controller, sesión + Bearer).
 *
 * Flujo de una regla: crear (BORRADOR) → vista previa obligatoria →
 * activar (primera firma, PENDIENTE) → aprobar (segundo operador, ACTIVA) →
 * cerrar. Los verbos van por `op=` (el param `action` está reservado por
 * app.php). Los errores NO se capturan aquí: los componentes hacen try/catch
 * + toast. `ApiError.errorCode` trae el código estable (VALIDATION_ERROR,
 * FISC_RULE_STATE, FISC_PREVIEW_REQUIRED, FISC_SECOND_SIGNER, FISC_OVERLAP,
 * FISC_NOT_FOUND…) y `fieldErrors(e)` el detalle por campo.
 *
 * Ejemplo:
 *   const { id } = await fiscReglasService.create(data, "Exportación EE. UU.");
 *   const vp = await fiscReglasService.preview(id, { partner: 9069 });
 *   await fiscReglasService.activate(id, vp.token, "Revisada la vista previa");
 */
import { http } from "./http";
import type { FiscCatalogo } from "./fiscConfig.service";

export type ReglaEstado = "BORRADOR" | "PENDIENTE" | "ACTIVA" | "CERRADA";
export type ReglaPolitica = "fijar" | "acumular" | "bloquear";

/** Parámetro del esquema de una acción (Fisc_Action_Base::campo). */
export interface ParamDef {
  tipo:
    | "texto"
    | "entero"
    | "decimal"
    | "booleano"
    | "fecha"
    | "pais"
    | "lista";
  obligatorio: boolean;
  etiquetas: Record<string, string>;
  /** Lista cerrada de valores admitidos (enum). */
  valores?: string[];
  defecto?: string | number | boolean;
  ayuda?: string;
}

/** Acción del catálogo de reglas con el esquema de sus parámetros. */
export interface ReglaAccion {
  codigo: string;
  etapa: string;
  politica: ReglaPolitica;
  grupo: string;
  fase: string;
  implementada: boolean;
  descripcion: string;
  esquema: Record<string, ParamDef> | null;
  /** false para FIJAR_VALOR (sigue en la pestaña de valores) y las no implementadas. */
  crea_regla: boolean;
}

/** `op=catalogo`: el de la configuración fiscal más estados y política de firmas. */
export interface ReglasCatalogo extends Omit<FiscCatalogo, "acciones"> {
  acciones: ReglaAccion[];
  estados: ReglaEstado[];
  /** true si activar exige la aprobación de un segundo operador. */
  doble_firma: boolean;
}

/** Una regla de fisc_reglas tal como la devuelve la API. */
export interface Regla {
  id: number;
  codigo: string;
  nombre: string;
  etapa: string;
  accion: string;
  estado: ReglaEstado;
  params: Record<string, unknown>;
  condicion_json: string | null;
  iso_paese: string;
  id_partner: number;
  id_servizio: number;
  id_cliente: number;
  prioridad: number;
  data_inizio: string;
  data_fine: string | null;
  descrizione: string | null;
  rif_normativo: string;
  insert_user?: number | null;
  politica: ReglaPolitica | "";
  grupo: string;
  resumen_condicion: string;
  resumen_accion: string;
  /** Huella de la versión (la que identifica la vista previa). */
  huella: string;
  n_conflictos?: number;
}

/** Un conflicto entre dos reglas (Fisc_Reglas_Conflict_Service::conflicto). */
export interface ReglaConflicto {
  id_a: number;
  codigo_a: string;
  id_b: number;
  codigo_b: string;
  /** BORRADOR cuando el conflicto es de un borrador con una regla que actúa (va siempre en `a`). */
  estado_a: ReglaEstado;
  estado_b: ReglaEstado;
  etapa: string;
  accion_a: string;
  accion_b: string;
  grupo: string;
  politica: ReglaPolitica;
  gravedad: "aviso" | "info";
  certeza: "segura" | "posible";
  nota: string;
  solape: { desde: string; hasta: string | null };
  /** Con política «fijar»: id de la regla que gana (0 = la regla en construcción). */
  ganadora: number | null;
  /** Con «acumular»: ids en el orden de aplicación. */
  orden: number[];
  motivo: string;
}

/** `op=row`: la regla con su uso, vista previa, firmas y conflictos. */
export interface ReglaDetalle extends Regla {
  aplicada: boolean;
  ultima_aplicacion: string | null;
  /** Hay vista previa de la versión actual (BORRADOR/PENDIENTE). */
  vista_previa: boolean;
  firmas: {
    creador: number;
    primera_firma: number | null;
    segunda_firma: number | null;
  };
  conflictos: ReglaConflicto[];
}

/** Campos editables de una regla (create/update). */
export interface ReglaInput {
  etapa?: string;
  accion?: string;
  parametros?: Record<string, unknown>;
  /** Condición del constructor (JSON como texto) o vacío = siempre. */
  condicion?: string | null;
  iso_paese?: string;
  id_partner?: number;
  id_servizio?: number;
  id_cliente?: number;
  prioridad?: number;
  data_inizio?: string;
  data_fine?: string | null;
  nombre?: string;
  descrizione?: string;
  rif_normativo?: string;
  codigo?: string;
}

export interface PreviewOpts {
  partner?: number;
  cliente?: number;
  desde?: string;
  hasta?: string;
  fecha?: string;
  limite?: number;
  todas?: boolean;
}

export type PreviewEstado =
  | "SIN_CAMBIOS"
  | "CAMBIA"
  | "BLOQUEADA_CON_REGLA"
  | "BLOQUEADA_SIN_REGLA"
  | "SIN_FACTURA"
  | "ERROR";

export interface PreviewTotales {
  neto: number;
  iva: number;
  total: number;
  retenciones: number;
  bollo: number;
  a_pagar: number;
}

export interface PreviewFactura {
  id_cliente: number;
  estado: PreviewEstado;
  motivo: string;
  diferencias: Array<{
    donde: string;
    campo: string;
    sin_regla: string;
    con_regla: string;
  }>;
  reglas_factura: Array<{
    concepto: string;
    sin_regla: unknown;
    con_regla: unknown;
  }>;
  totales: { sin_regla?: PreviewTotales; con_regla?: PreviewTotales };
}

/** `op=preview`: lo que cambiaría y el token de la versión previsualizada. */
export interface PreviewResult {
  regla: { id: number; codigo: string; accion: string; etapa: string };
  periodo: { desde: string; hasta: string; fecha: string };
  partner: number;
  resumen: {
    clientes: number;
    cambian: number;
    sin_cambios: number;
    bloqueadas_con_regla: number;
    bloqueadas_sin_regla: number;
    sin_factura: number;
    error: number;
    totales: { sin_regla: number; con_regla: number; diferencia: number };
  };
  facturas: PreviewFactura[];
  avisos: string[];
  /** Los mismos avisos como código y parámetros, para traducirlos (preview.avisos.<codigo>). */
  avisos_codigos?: Array<{
    codigo: string;
    params: Record<string, string | number>;
  }>;
  truncado: boolean;
  token: string;
  version: string;
}

/** Una regla citada por «Por qué» (Fisc_Rule_Explain_Service::item). */
export interface WhyRegla {
  etapa: string;
  accion: string;
  id_regla: number;
  codigo: string;
  nombre: string;
  rif_normativo: string;
  resumen: string;
  /** Solo en las reglas de la factura entera. */
  importe?: number;
}

export interface WhyLinea {
  id: number;
  descriz: string;
  cod_iva: string;
  aliquota_iva: number;
  importo_netto: number;
  importo_iva: number;
  reglas: WhyRegla[];
}

/** `op=explicar`: panel «Por qué» de una factura. */
export interface WhyResult {
  id_fattura: number;
  importe_a_pagar: {
    total: number;
    retenciones: number;
    iva_split: number;
    bollo: number;
    importe_a_pagar: number;
  } | null;
  lineas: WhyLinea[];
  factura: WhyRegla[];
  /** Retenciones del envío ya liberadas: quién, cuándo y por qué (vacío si no consta). */
  liberadas?: Array<
    WhyRegla & {
      motivo_liberacion: string;
      usuario_liberacion: number;
      fecha_liberacion: string;
    }
  >;
  reglas: Record<
    string,
    {
      codigo: string;
      nombre: string;
      etapa: string;
      accion: string;
      parametros: Record<string, unknown>;
    }
  >;
}

export interface ReglasFilters {
  etapa?: string;
  accion?: string;
  estado?: string;
  iso_paese?: string;
  id_partner?: number | null;
  id_cliente?: number | null;
  id_servizio?: number | null;
  fecha?: string;
  con_conflictos?: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const BASE = "/api_fisc_reglas";

function query(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q.set(k, v === true ? "1" : String(v));
  }
  return q.toString();
}

async function get<T>(params: Record<string, unknown>): Promise<T> {
  const res = await http<ApiEnvelope<T>>(`${BASE}?${query(params)}`);
  return res.data;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await http<ApiEnvelope<T>>(`${BASE}?op=${String(body.op)}`, {
    method: "POST",
    body,
  });
  return res.data;
}

export const fiscReglasService = {
  /** Catálogo: datos, operadores, etapas, acciones con su esquema y política de firmas. */
  catalogo(): Promise<ReglasCatalogo> {
    return get<ReglasCatalogo>({ op: "catalogo" });
  },

  /** Listado con filtros; un partner solo ve las reglas generales y las suyas. */
  list(filters: ReglasFilters = {}): Promise<Regla[]> {
    return get<Regla[]>({ op: "list", ...filters });
  },

  /** Una regla con su uso, firmas y conflictos. */
  row(id: number): Promise<ReglaDetalle> {
    return get<ReglaDetalle>({ op: "row", id });
  },

  /** Conflictos de una regla guardada (id) o de todas (sin parámetros). */
  conflictos(id?: number): Promise<{
    conflictos: ReglaConflicto[];
    regla: Regla | null;
  }> {
    return get({ op: "conflictos", id });
  },

  /** Conflictos de una regla que aún no se ha guardado (el asistente). */
  conflictosDe(input: ReglaInput): Promise<{
    conflictos: ReglaConflicto[];
    regla: Regla | null;
  }> {
    const { parametros: _omit, ...resto } = input;
    void _omit;
    return get({
      op: "conflictos",
      ...resto,
      condicion: input.condicion ?? "",
    });
  },

  /** Panel «Por qué» de una factura (404 si no existe o es de otro partner). */
  explicar(idFattura: number): Promise<WhyResult> {
    return get<WhyResult>({ op: "explicar", id_fattura: idFattura });
  },

  create(
    data: ReglaInput,
    motivo: string,
  ): Promise<{ id: number; estado: ReglaEstado }> {
    return post({ op: "create", data, motivo });
  },

  /** Edita una regla en BORRADOR (también la condición y los parámetros). */
  update(
    id: number,
    data: ReglaInput,
    motivo: string,
  ): Promise<{ ok: boolean }> {
    return post({ op: "update", id, data, motivo });
  },

  /** Vista previa obligatoria: simula la regla sin escribir nada. */
  preview(id: number, opts: PreviewOpts = {}): Promise<PreviewResult> {
    return post({ op: "preview", id, ...opts });
  },

  /** Primera firma (PENDIENTE) o activación directa si la doble firma está apagada. */
  activate(
    id: number,
    token: string,
    motivo: string,
  ): Promise<{
    estado: ReglaEstado;
    requiere_aprobacion: boolean;
    version: string;
  }> {
    return post({ op: "activate", id, token, motivo });
  },

  /** Segunda firma: un operador distinto del creador y de quien activó. */
  approve(id: number, motivo: string): Promise<{ estado: ReglaEstado }> {
    return post({ op: "approve", id, motivo });
  },

  /** Devuelve una regla pendiente a borrador. */
  reject(id: number, motivo: string): Promise<{ ok: boolean }> {
    return post({ op: "reject", id, motivo });
  },

  /** Cierra una regla activa con fecha de fin (una regla aplicada no se borra). */
  close(
    id: number,
    dataFine: string,
    motivo: string,
  ): Promise<{ ok: boolean }> {
    return post({ op: "close", id, data_fine: dataFine, motivo });
  },

  /** Baja de una regla que nunca se aplicó. */
  deactivate(id: number, motivo: string): Promise<{ ok: boolean }> {
    return post({ op: "deactivate", id, motivo });
  },

  /** Libera el envío de una factura retenida por una regla RETENER_ENVIO. */
  releaseHold(
    idFattura: number,
    motivo: string,
  ): Promise<{ liberadas: number; certificacion: unknown }> {
    return post({ op: "release_hold", id_fattura: idFattura, motivo });
  },
};
