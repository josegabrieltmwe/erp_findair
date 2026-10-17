import { http } from "./http";

export interface SubcontractingAssignment {
  id?: number;
  id_spedizione: number;
  id_partner: number;
  partner_name?: string;
  status?: string;
  insert_datetime?: string;
}

export const subcontractingService = {
  list(
    shipment_id: number,
  ): Promise<{ success: boolean; assignments?: SubcontractingAssignment[] }> {
    return http("/api_shipment_subcontracting", { query: { shipment_id } });
  },
  assign(
    shipment_id: number,
    id_partner: number,
  ): Promise<{
    success: boolean;
    assignment?: SubcontractingAssignment;
    error?: string;
  }> {
    return http("/api_shipment_subcontracting", {
      method: "POST",
      body: { shipment_id, id_partner, action: "assign" },
    });
  },
  remove(assignment_id: number): Promise<{ success: boolean }> {
    return http("/api_shipment_subcontracting", {
      method: "POST",
      body: { assignment_id, action: "remove" },
    });
  },
};
