/**
 * WS-A cargo shipment charges REST client.
 *
 * Backend: `/api_cargo_shipment_charges` (Web_Cargo_Charges_Crud_Controller).
 * Schema: `docs/openapi/cargo/cargo_charges.yaml`.
 *
 * Replaces the legacy `chargeDetailsService` (action-on-body POST) in
 * `cargo.service.ts`. Both coexist during the rollout window. The legacy
 * client is kept callable until the v2 SPA renders the editable table.
 */
import { http } from "./http";
import type {
  CargoChargeRow,
  CargoChargeListResponse,
  CargoChargeCreate,
  CargoChargePatch,
} from "./cargo_charges.types";

const BASE = "/api_cargo_shipment_charges";

export const cargoChargesService = {
  /** GET /api_cargo_shipment_charges?cargo_id=N → list of charge rows. */
  list(cargo_id: number): Promise<CargoChargeListResponse> {
    return http<CargoChargeListResponse>(BASE, { query: { cargo_id } });
  },

  /** POST /api_cargo_shipment_charges?cargo_id=N → create a new row. */
  create(cargo_id: number, body: CargoChargeCreate): Promise<CargoChargeRow> {
    return http<CargoChargeRow>(BASE, {
      method: "POST",
      query: { cargo_id },
      body,
    });
  },

  /**
   * PATCH /api_cargo_shipment_charges?cargo_id=N&item_id=M → update
   * one or more allowed fields. Only `costo_unit`, `costo_min`, `costo_max`,
   * `somma`, `nome` and `code` can be patched.
   */
  update(
    cargo_id: number,
    item_id: number,
    body: CargoChargePatch,
  ): Promise<CargoChargeRow> {
    return http<CargoChargeRow>(BASE, {
      method: "PATCH",
      query: { cargo_id, item_id },
      // ids also in body as a fallback against a lost query string.
      body: { cargo_id, item_id, ...body },
    });
  },

  /** DELETE /api_cargo_shipment_charges?cargo_id=N&item_id=M → soft-delete (204). */
  remove(cargo_id: number, item_id: number): Promise<void> {
    return http(BASE, {
      method: "DELETE",
      query: { cargo_id, item_id },
      // ids also in body as a fallback against a lost query string.
      body: { cargo_id, item_id },
    }) as unknown as Promise<void>;
  },
};
