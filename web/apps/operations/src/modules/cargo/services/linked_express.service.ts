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
  success: boolean;
  shipment_id?: number;
  error?: string;
  message?: string;
}

export const linkedExpressService = {
  /**
   * Crea la leg express `tpc` a partir del cargo `cargoId`.
   * Resuelve con `{ success, shipment_id }` en éxito.
   */
  createFromCargo(
    cargoId: number,
    tpc: LinkedExpressTpc,
  ): Promise<CreateFromCargoResult> {
    return http<CreateFromCargoResult>("/ajax_shipment_from_cargo", {
      method: "POST",
      body: { cargo_id: cargoId, tpc },
    });
  },
};
