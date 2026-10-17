import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * DGR / mercancía peligrosa — catálogo de sustancias UN (directorio UNR) y
 * declaración por expedición. NO reemplaza el flag booleano DGR (acc_danggoods /
 * supplement 6): es una capa de metadatos estructurados que se revela cuando la
 * expedición lleva un suplemento DGR/relacionado que amerita el número UN.
 *
 * Implementación ÚNICA compartida por courier (shipment_express, is_cargo=N) y
 * cargo (cargo_express, is_cargo=S). El único parámetro que cambia entre ambos
 * es el flag is_cargo; el contrato HTTP y los tipos son idénticos.
 *
 * Backend:
 *  - api_dgr_substances?op=search&q=  → catálogo UN (autocomplete). Hybrid auth.
 *  - api_shipment_dgr GET  ?shipment_id=&is_cargo=N|S → declaraciones del envío.
 *  - api_shipment_dgr POST {shipment_id,is_cargo,declarations[]} → reemplaza set.
 */

/** Fila del catálogo maestro de sustancias UN (dgr_substances). */
export interface DgrSubstance {
  id: number;
  un_number: string; // 'UN3480'
  proper_shipping_name: string;
  hazard_class: string | null; // '9'
  sub_risk_class: string | null;
  packing_group: string | null; // 'I' | 'II' | 'III'
  technical_name: string | null;
  lq_max_per_package: string | null; // límite LQ (ADR §3.4)
  tipomerce_sigla: string | null; // SHC afín (ELI, ELM, DGR…)
  default_regulation: string | null; // ADR/IATA/49CFR/TDG
}

/** Régimen de transporte de mercancía peligrosa. */
export type DgrTransportMode = "FR" | "LQ" | "EQ";

/** Declaración DGR de una expedición (fila de spedizioni_dgr). */
export interface DgrDeclaration {
  id?: number;
  id_dgr_substance: number | null;
  transport_mode: DgrTransportMode;
  un_number: string | null;
  proper_shipping_name: string | null;
  hazard_class: string | null;
  sub_risk_class?: string | null;
  packing_group: string | null;
  quantity_value: number | null;
  quantity_uom: string | null; // KG | L
  id_collo?: number | null;
  regulation_set?: string | null;
  technical_name?: string | null;
}

/** 'S' para cargo aéreo (spedizioni_cargo), 'N' para courier express. */
export type DgrIsCargo = "S" | "N";

/**
 * Autocomplete del directorio UNR: busca por número UN o por nombre técnico.
 * Neutral al modo cargo/express.
 */
export async function searchDgrSubstances(term: string): Promise<DgrSubstance[]> {
  const r = await http<ApiEnvelope<DgrSubstance[]>>("/api_dgr_substances", {
    query: { op: "search", q: term ?? "" },
  });
  return r?.success && Array.isArray(r.data) ? r.data : [];
}

/** Declaraciones DGR actuales de una expedición (is_cargo = 'S' cargo | 'N' express). */
export async function getDgrDeclarations(
  shipmentId: number | string,
  isCargo: DgrIsCargo = "N",
): Promise<DgrDeclaration[]> {
  const r = await http<ApiEnvelope<DgrDeclaration[]>>("/api_shipment_dgr", {
    query: { shipment_id: shipmentId, is_cargo: isCargo },
  });
  return r?.success && Array.isArray(r.data) ? r.data : [];
}

/**
 * Reemplaza el conjunto de declaraciones de la expedición (cutover en backend:
 * soft-delete de las activas + re-insert). Un array vacío borra todas.
 */
export async function saveDgrDeclarations(
  shipmentId: number | string,
  declarations: DgrDeclaration[],
  isCargo: DgrIsCargo = "N",
): Promise<ApiEnvelope<unknown>> {
  return http<ApiEnvelope<unknown>>("/api_shipment_dgr", {
    method: "POST",
    body: { shipment_id: shipmentId, is_cargo: isCargo, declarations },
  });
}

/**
 * Factory que liga el servicio a un modo (cargo/express) fijo, para que cada
 * app exponga la misma API `dgrService.{searchSubstances,getDeclarations,
 * saveDeclarations}` sin repetir el flag en cada llamada.
 */
export function createDgrService(isCargo: DgrIsCargo) {
  return {
    searchSubstances: searchDgrSubstances,
    getDeclarations: (shipmentId: number | string) =>
      getDgrDeclarations(shipmentId, isCargo),
    saveDeclarations: (shipmentId: number | string, declarations: DgrDeclaration[]) =>
      saveDgrDeclarations(shipmentId, declarations, isCargo),
  };
}
