/**
 * Linked-express service — crea las legs express (recogida/entrega/handler)
 * de un cargo llamando a `ajax_shipment_from_cargo`
 * (Ajax_Shipment_From_Cargo_Controller → Shipment_From_Cargo_Service).
 *
 * El backend puebla la nueva expedición con los datos del cargo (colli, peso,
 * direcciones, suplementos, servicio) — paridad legacy `spedy.php:32-94` — y
 * actualiza el cargo con el `shipment_id` creado. Devuelve ese id para poder
 * abrir el detalle de la express al instante, SIN recarga de página (antes se
 * navegaba a `/shipment?from_cargo=…`, que recargaba toda la app).
 *
 * `tpc`: P (recogida), D (entrega), H (handler). El 'C' legacy (consegna) es
 * el 'D' moderno; aquí ya trabajamos con el contrato P/D/H.
 */

import { http } from "@cargo/services/http";

export type LinkedExpressTpc = "P" | "D" | "H";

export interface CreateFromCargoResult {
  /** true solo si el API confirmó Y devolvió un id de expedición > 0. */
  success: boolean;
  /** Id de la express creada (0 si no llegó). */
  shipment_id: number;
  /** Código/texto de error del API (no se muestra tal cual: el FE usa i18n). */
  error?: string;
}

/** Respuesta cruda de `ajax_shipment_from_cargo`: el id viaja en `data`. */
interface RawFromCargoResponse {
  success?: boolean;
  data?: { shipment_id?: number | string | null } | null;
  shipment_id?: number | string | null;
  error?: unknown;
  message?: string;
}

/**
 * Normaliza la respuesta de `ajax_shipment_from_cargo`. El API responde
 * `{success, data:{shipment_id,…}, message}`; versiones anteriores ponían
 * `shipment_id` en la raíz. Se aceptan ambas y el éxito exige id > 0.
 */
export function normalizeFromCargoResponse(raw: unknown): CreateFromCargoResult {
  const r = (raw ?? {}) as RawFromCargoResponse;
  const n = Number(r.data?.shipment_id ?? r.shipment_id ?? 0);
  const id = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  const success = r.success === true && id > 0;
  const out: CreateFromCargoResult = { success, shipment_id: id };
  if (!success) {
    const e = r.error;
    out.error =
      typeof e === "string"
        ? e
        : e && typeof e === "object" && "code" in e
          ? String((e as { code?: unknown }).code ?? "")
          : undefined;
  }
  return out;
}

export const linkedExpressService = {
  /**
   * Crea la leg express `tpc` a partir del cargo `cargoId`.
   * Resuelve con `{ success, shipment_id }` ya normalizado.
   */
  async createFromCargo(
    cargoId: number,
    tpc: LinkedExpressTpc,
  ): Promise<CreateFromCargoResult> {
    const raw = await http<RawFromCargoResponse>("/ajax_shipment_from_cargo", {
      method: "POST",
      body: { cargo_id: cargoId, tpc },
    });
    return normalizeFromCargoResponse(raw);
  },
};
