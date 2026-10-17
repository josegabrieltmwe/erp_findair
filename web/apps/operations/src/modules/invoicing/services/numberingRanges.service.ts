/**
 * numberingRanges.service — rangos de validez de las series de numeración
 * (api_invoice_numbering_ranges). Verbos por `op=`. Toda escritura exige un
 * motivo y, sin `confirmar: true`, el servidor solo devuelve la vista previa.
 */
import { http } from "./http";

export type RangeReinicio = "NUNCA" | "ANUAL" | "MENSUAL";

export interface NumberingRange {
  id: number;
  id_engine: number;
  data_inizio: string;
  /** Vacío o 0000-00-00 = abierto. */
  data_fine: string | null;
  formato: string;
  valore_iniziale: number;
  reinicio: RangeReinicio | string;
  /** Vigente hoy. */
  vigente?: boolean;
  /** Ya ha numerado alguna factura. */
  usado?: boolean;
  primer_numero?: string;
}

export interface RangeEngine {
  id: number;
  codice: string;
  label: string;
  tipo_fattura: string;
  rangos: NumberingRange[];
}

export interface RangeInput {
  id_engine: number;
  formato: string;
  data_inizio: string;
  data_fine?: string;
  reinicio?: RangeReinicio;
  valore_iniziale?: number;
  motivo: string;
}

export interface RangePreview {
  serie?: string;
  desde?: string;
  hasta?: string | null;
  formato?: string;
  primer_numero?: string;
  siguientes?: Array<{ numero?: number; numero_completo: string }> | string[];
}

export interface RangeSaveResult {
  guardado: boolean;
  requiere_confirmacion?: boolean;
  preview?: RangePreview;
  avisos?: string[];
  rango?: Record<string, unknown>;
}

export interface NextNumberPreview {
  serie: string;
  id_engine: number;
  fecha: string;
  primer_numero_rango: string;
  siguientes: Array<{ numero: number; numero_completo: string }>;
  orientativo: boolean;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
}

const BASE = "/api_invoice_numbering_ranges";

/** El rango no tiene fecha de fin. */
export function isOpenRange(r: Pick<NumberingRange, "data_fine">): boolean {
  const f = (r.data_fine ?? "").trim();
  return f === "" || f === "0000-00-00";
}

export function buildListQuery(engineId?: number): string {
  const p = new URLSearchParams({ op: "list" });
  if (engineId && engineId > 0) p.set("id_engine", String(engineId));
  return p.toString();
}

export function buildPreviewQuery(
  engineId: number,
  fecha?: string,
  n?: number,
): string {
  const p = new URLSearchParams({ op: "preview", id_engine: String(engineId) });
  if (fecha) p.set("fecha", fecha);
  if (n && n > 0) p.set("n", String(n));
  return p.toString();
}

/** Cuerpo de op=create: solo los campos que el servidor lee. */
export function buildCreateBody(
  input: RangeInput,
  confirmar: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id_engine: input.id_engine,
    formato: input.formato.trim(),
    data_inizio: input.data_inizio,
    motivo: input.motivo.trim(),
    confirmar,
  };
  if (input.data_fine) body.data_fine = input.data_fine;
  if (input.reinicio) body.reinicio = input.reinicio;
  if (input.valore_iniziale && input.valore_iniziale > 0) {
    body.valore_iniziale = input.valore_iniziale;
  }
  return body;
}

/** Cuerpo de op=close sin rango sucesor: termina el rango en `data_fine`. */
export function buildCloseBody(
  engineId: number,
  id: number,
  dataFine: string,
  motivo: string,
): Record<string, unknown> {
  return {
    op: "close",
    id_engine: engineId,
    id,
    data_fine: dataFine,
    motivo: motivo.trim(),
  };
}

export const numberingRangesService = {
  async list(engineId?: number, signal?: AbortSignal): Promise<RangeEngine[]> {
    const res = await http<ApiEnvelope<RangeEngine[]>>(
      `${BASE}?${buildListQuery(engineId)}`,
      { signal },
    );
    return res.data ?? [];
  },

  async preview(
    engineId: number,
    fecha?: string,
    n?: number,
  ): Promise<NextNumberPreview> {
    const res = await http<ApiEnvelope<NextNumberPreview>>(
      `${BASE}?${buildPreviewQuery(engineId, fecha, n)}`,
    );
    return res.data;
  },

  async create(input: RangeInput, confirmar: boolean): Promise<RangeSaveResult> {
    const res = await http<ApiEnvelope<RangeSaveResult>>(`${BASE}?op=create`, {
      method: "POST",
      body: buildCreateBody(input, confirmar),
    });
    return res.data;
  },

  async close(
    engineId: number,
    id: number,
    dataFine: string,
    motivo: string,
  ): Promise<void> {
    await http(`${BASE}?op=close`, {
      method: "POST",
      body: buildCloseBody(engineId, id, dataFine, motivo),
    });
  },
};
