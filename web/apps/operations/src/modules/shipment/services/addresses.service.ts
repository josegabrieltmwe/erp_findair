import { http } from "./http";
import type { ShipmentAddress } from "./shipment.types";

export interface AddressUpsertResult {
  success: boolean;
  address?: ShipmentAddress;
  error?: string;
}

export const addressesService = {
  /** ajax_shipment_addresses POST — upsert pickup (P) or delivery (D). */
  upsert(
    shipment_id: number,
    tipo: "P" | "D",
    payload: Partial<ShipmentAddress>,
  ): Promise<AddressUpsertResult> {
    return http<AddressUpsertResult>("/ajax_shipment_addresses", {
      method: "POST",
      body: { shipment_id, tipo, address: payload },
    });
  },

  /**
   * Revierte el origen a la sede del cliente: presa_tipo='S' + soft-delete de
   * la fila de pickup 'P'. El backend lo hace atómicamente.
   */
  useSede(shipment_id: number): Promise<AddressUpsertResult> {
    return http<AddressUpsertResult>("/ajax_shipment_addresses", {
      method: "POST",
      body: { shipment_id, action: "use_sede" },
    });
  },
};
