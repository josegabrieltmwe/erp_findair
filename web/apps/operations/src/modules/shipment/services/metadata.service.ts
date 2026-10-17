import { http } from "./http";

/**
 * Metadata CRUD — spedizioni_meta editor (MetadatiCard.vue).
 *
 * Session-auth wrapper around ajax_shipment_metadata
 * (Ajax_Shipment_Metadata_Controller), the internal counterpart of the
 * OAuth-only External_Shipment_Metadata_Controller. Both delegate to the
 * same Shipment_Metadata_Service, so reads/writes here are consistent with
 * whatever the external API and the plain shipment GET (`metadata` field)
 * already show.
 *
 * GET    ?shipment_id=N            → { shipment_id, metadata: {...} }
 * PATCH  ?shipment_id=N  {metadata:{k:v,...}} → merge (adds/overwrites keys)
 * DELETE ?shipment_id=N&key=k      → removes one key
 */
export interface MetadataResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    metadata: Record<string, unknown>;
  };
  error?: string;
  message?: string;
}

export const metadataService = {
  get(shipment_id: number): Promise<MetadataResponse> {
    return http<MetadataResponse>("/ajax_shipment_metadata", {
      query: { shipment_id },
    });
  },

  /** Merge one or more key-value pairs. Existing keys not in `kv` are kept. */
  merge(
    shipment_id: number,
    kv: Record<string, string>,
  ): Promise<MetadataResponse> {
    return http<MetadataResponse>("/ajax_shipment_metadata", {
      method: "PATCH",
      query: { shipment_id },
      body: { metadata: kv },
    });
  },

  deleteKey(shipment_id: number, key: string): Promise<MetadataResponse> {
    return http<MetadataResponse>("/ajax_shipment_metadata", {
      method: "DELETE",
      query: { shipment_id, key },
    });
  },
};
