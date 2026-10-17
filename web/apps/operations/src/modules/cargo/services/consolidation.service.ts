import { http } from "./http";

const BASE = "/unified_cargo_consolidation";

export interface ConsolidationHouseAgg {
  id_spediz: number;
  peso_real: number;
  chargeable: number;
  colli: number;
}

export interface ConsolidationAggregate {
  cargo_id: number;
  house_count: number;
  peso_real_tot: number;
  chargeable_tot: number;
  colli_tot: number;
  houses: ConsolidationHouseAgg[];
}

export interface ConsolidationHouseRow {
  id: number | string;
  id_cargo: number | string;
  id_spediz: number | string;
  tipo: string;
  shipper_nome?: string | null;
  consignee_nome?: string | null;
  goods_descr?: string | null;
  peso_house?: number | string | null;
}

export interface ConsolidationView {
  cargo_id: number;
  houses: ConsolidationHouseRow[];
  aggregate: ConsolidationAggregate;
}

export interface AttachableShipment {
  id: number | string;
  id_cliente: number | string;
  RIF_cliente: string;
  peso: string;
  colli: string;
  data_sped0: string;
}

export const consolidationService = {
  /** List houses + the master aggregate for a consolidation cargo. */
  get(cargo_id: number): Promise<ConsolidationView> {
    return http<ConsolidationView>(BASE, { query: { cargo_id } });
  },

  /** Candidate express shipments that can be attached (autocomplete source). */
  attachable(
    cargo_id: number,
    q = "",
  ): Promise<{ items: AttachableShipment[] }> {
    return http<{ items: AttachableShipment[] }>(BASE, {
      query: { cargo_id, attachable: 1, q },
    });
  },

  /** Attach an existing express shipment to the cargo master. */
  attach(
    cargo_id: number,
    spedizione_id: number,
  ): Promise<{ success: boolean; house_id?: number; idempotent?: boolean }> {
    return http(BASE, {
      method: "POST",
      query: { cargo_id },
      body: { cargo_id, spedizione_id },
    });
  },

  /** Detach a shipment from the cargo master. */
  detach(
    cargo_id: number,
    spedizione_id: number,
  ): Promise<{ success: boolean }> {
    return http(BASE, {
      method: "DELETE",
      query: { cargo_id, spedizione_id },
    });
  },
};
