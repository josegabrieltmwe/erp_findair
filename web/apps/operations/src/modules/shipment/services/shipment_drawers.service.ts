/**
 * WS-S-I + WS-S-J + WS-S-K — read-only feeds for the shipment SPA
 * drawers/cards added by plan v2.
 *
 * All three endpoints share the same shape contract: { items, cursor }
 * for paginated lists or a flat object for relations. The frontend
 * services here only typecast; the controllers handle access gating
 * (Shipment_Access_Service with type='express') and the telemetry.
 */
import { http } from "./http";

export interface TrackingEvent {
  ts: string;
  code: string;
  description: string;
  location: string;
}

export interface CrmRelation {
  id: number;
  stato_pratica: string;
  last_activity: string | null;
  oggetto?: string;
  data_next?: string | null;
  /** SPA modern (paridad crm_form.php); preferir sobre legacy_url. */
  url?: string;
  legacy_url: string;
}

export interface GiacenzaPointer {
  id: number;
  code: string;
  quantity: number;
  /** Abierta (data_close en el centinela) vs cerrada — para el semáforo. */
  is_open?: boolean;
  legacy_url: string;
}

export interface FatturaPointer {
  id: number;
  kind: string;
  number: string;
  date: string | null;
  amount: number | null;
  legacy_url: string;
}

export interface ShipmentRelations {
  crm: CrmRelation | null;
  crms: CrmRelation[];
  crm_count: number;
  crm_allowed?: boolean;
  giacenze: GiacenzaPointer[];
  fatture: FatturaPointer[];
}

export interface ShipmentAuditEntry {
  id: number;
  ts: string;
  tabella: string;
  id_record: number;
  campo: string;
  valore_old: string | null;
  valore_new: string | null;
  user: string;
  user_name: string | null;
  ip: string | null;
}

export const shipmentTrackingService = {
  list(shipment_id: number): Promise<{
    items: TrackingEvent[];
    cursor: { next: string | null; limit: number };
  }> {
    return http("/api_shipment_tracking", { query: { shipment_id } });
  },

  /**
   * Force a live tracking query against the courier for this shipment
   * (admin_tracking_api, action "single"). Synchronous and persisting: updates
   * consegna_stato, opens giacenza, records awb_reso_tnt. Distinct from list(),
   * which only re-reads the stored history. Returns processed>0 when the
   * courier answered.
   */
  force(shipment_id: number): Promise<{
    success: boolean;
    processed?: number;
    errors?: number;
    error?: string;
  }> {
    return http("/admin_tracking_api", {
      method: "POST",
      body: { action: "single", shipment_id },
    });
  },
};

export const shipmentRelationsService = {
  get(shipment_id: number): Promise<ShipmentRelations> {
    return http<ShipmentRelations>("/api_shipment_relations", {
      query: { shipment_id },
    });
  },
};

export const shipmentAuditService = {
  list(
    shipment_id: number,
    limit = 50,
  ): Promise<{
    items: ShipmentAuditEntry[];
    cursor: { next: string | null; limit: number };
  }> {
    return http("/api_shipment_audit", { query: { shipment_id, limit } });
  },
  /** Per-field modification history (legacy spedy_form_show_xlog.php / ShowXLog). */
  async fieldHistory(
    shipment_id: number,
    campo: string,
    limit = 30,
  ): Promise<ShipmentAuditEntry[]> {
    const r = await http<{ items: ShipmentAuditEntry[] }>(
      "/api_shipment_audit",
      { query: { shipment_id, campo, limit } },
    );
    return r.items ?? [];
  },
};
