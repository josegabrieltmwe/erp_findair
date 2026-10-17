/**
 * numbering.service — motores de numeración de facturas por partner.
 *
 * Cada partner define sus propias series (formato, padding, periodo de
 * reinicio) y el operador elige cuál usar al crear la factura.
 *
 * Los verbos van por `op=` (el param `action` está reservado por app.php para
 * el routing). Los errores NO se capturan aquí: se deja propagar el ApiError
 * del interceptor y el store hace try/catch + toast.
 */
import { http } from "./http";

export type NumberingTipo = "A" | "P";
export type NumberingReinicio = "anual" | "mensual" | "nunca";

export interface NumberingEngine {
  id: number;
  id_anagrafica_partn: number;
  codice: string;
  label: string;
  tipo_fattura: NumberingTipo;
  /** Plantilla con tokens. Debe contener {n}. Ej: FA-{anno}-{n} */
  formato: string;
  padding: number;
  reinicio: NumberingReinicio;
  valore_inicial: number;
  is_default: "S" | "N";
  stato: "A" | "O";
  insert_user?: number | null;
  insert_datetime?: string | null;
  modif_user?: number | null;
  modif_datetime?: string | null;
}

/** Payload de creación/edición. `codice` es inmutable tras crear. */
export interface NumberingEngineInput {
  codice?: string;
  label: string;
  tipo_fattura: NumberingTipo;
  formato: string;
  padding: number;
  reinicio: NumberingReinicio;
  valore_inicial: number;
  is_default: "S" | "N";
}

export interface NumberingCounter {
  id: number;
  id_engine: number;
  /** 'YYYY', 'YYYY-MM', o '-' si el motor no reinicia. */
  periodo: string;
  ultimo_valore: number;
  modif_datetime: string | null;
}

/** Una fila por periodo: si `emitidos` < `esperados`, la serie tiene huecos. */
export interface NumberingAuditRow {
  periodo: string;
  lo: number;
  hi: number;
  emitidos: number;
  esperados: number;
}

/**
 * Previsualización del siguiente número. Es ORIENTATIVA: entre esta llamada y
 * el guardado otra factura puede consumir el número. El definitivo se fija al
 * crear la factura.
 */
export interface NumberingPreview {
  anno: number;
  tipo_fattura: NumberingTipo;
  next_numero: number;
  numero_formattato: string | null;
  id_engine: number | null;
  periodo?: string;
  orientativo: boolean;
  /** 'engine' = motor configurado; 'legacy' = fallback MAX+1 sin motor. */
  fuente: "engine" | "legacy";
  partner_id: number;
  label: string;
  /**
   * true si en este mismo periodo fiscal ya se emitieron facturas con OTRA
   * serie. Dos series paralelas en el mismo periodo es lo que una inspección
   * lee como numeración no progresiva: se avisa, no se bloquea.
   */
  mixing?: boolean;
  mixing_engines?: Array<{ id_engine: number; label: string; n: number }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

const CRUD = "/api_invoice_numbering_engines";
const PREVIEW = "/api_invoice_numbering";

export const numberingService = {
  /** Motores del partner. `tipo` filtra activas/pasivas. */
  async list(
    tipo?: NumberingTipo,
    signal?: AbortSignal,
  ): Promise<NumberingEngine[]> {
    const q = tipo ? `&tipo=${tipo}` : "";
    const res = await http<ApiEnvelope<NumberingEngine[]>>(
      `${CRUD}?op=list${q}`,
      { signal },
    );
    return res.data ?? [];
  },

  async create(input: NumberingEngineInput): Promise<NumberingEngine> {
    const res = await http<ApiEnvelope<NumberingEngine>>(`${CRUD}?op=create`, {
      method: "POST",
      body: input,
    });
    return res.data;
  },

  async update(
    id: number,
    input: Partial<NumberingEngineInput>,
  ): Promise<NumberingEngine> {
    const res = await http<ApiEnvelope<NumberingEngine>>(`${CRUD}?op=update`, {
      method: "PUT",
      body: { id, ...input },
    });
    return res.data;
  },

  async remove(
    id: number,
  ): Promise<{ deleted: boolean; id: number; facturas_emitidas: number }> {
    const res = await http<
      ApiEnvelope<{ deleted: boolean; id: number; facturas_emitidas: number }>
    >(`${CRUD}?op=delete&id=${id}`, { method: "DELETE" });
    return res.data;
  },

  /** Contadores (uno por periodo) de un motor. */
  async counters(
    id: number,
    signal?: AbortSignal,
  ): Promise<NumberingCounter[]> {
    const res = await http<ApiEnvelope<NumberingCounter[]>>(
      `${CRUD}?op=counters&id=${id}`,
      { signal },
    );
    return res.data ?? [];
  },

  /** Auditoría de huecos de la serie. */
  async audit(id: number, signal?: AbortSignal): Promise<NumberingAuditRow[]> {
    const res = await http<ApiEnvelope<NumberingAuditRow[]>>(
      `${CRUD}?op=audit&id=${id}`,
      { signal },
    );
    return res.data ?? [];
  },

  /**
   * Siguiente número SIN consumirlo. Sin `engineId` usa el motor por defecto
   * del partner; si no hay ninguno, `fuente` viene como 'legacy'.
   */
  async preview(
    tipo: NumberingTipo,
    fecha?: string,
    engineId?: number,
    signal?: AbortSignal,
  ): Promise<NumberingPreview> {
    const params = new URLSearchParams({ tipo });
    if (fecha) params.set("fecha", fecha);
    if (engineId && engineId > 0) params.set("engine_id", String(engineId));
    const res = await http<ApiEnvelope<NumberingPreview>>(
      `${PREVIEW}?${params.toString()}`,
      { signal },
    );
    return res.data;
  },
};

/**
 * Aplica la plantilla en cliente, para el preview en vivo del formulario
 * mientras se edita (sin ir al servidor en cada tecla).
 *
 * Espeja Invoice_Numbering_Service::format() de PHP. Devuelve el entero
 * desnudo cuando el formato es '{n}' sin padding — el comportamiento legacy.
 */
export function formatSample(
  formato: string,
  padding: number,
  numero: number,
  tipo: NumberingTipo = "A",
  fecha: Date = new Date(),
): string {
  const n =
    padding > 0 ? String(numero).padStart(padding, "0") : String(numero);
  const yyyy = String(fecha.getFullYear());
  return formato
    .replace(/\{n\}/g, n)
    .replace(/\{anno\}/g, yyyy)
    .replace(/\{aa\}/g, yyyy.slice(-2))
    .replace(/\{mese\}/g, String(fecha.getMonth() + 1).padStart(2, "0"))
    .replace(/\{serie\}/g, tipo);
}

/** El token {n} es obligatorio: sin él todas las facturas del periodo compartirían número. */
export function formatoIsValid(formato: string): boolean {
  return formato.includes("{n}");
}
