/**
 * TypeScript types for the WS-A cargo shipment charges REST API.
 *
 * Source of truth: `docs/openapi/cargo/cargo_charges.yaml`.
 * Keep these in sync with the schema. Once the WS-A frontend stabilizes
 * we'll generate this file with `openapi-typescript` and remove the
 * hand-written types.
 */

/** Type of charge row in `spedizioni_cargo_dett`. */
export type CargoChargeTipo = "P" | "S" | "V" | "M";
/** P=peso (base price), S=supplemento, V=valuta, M=optional/misc */

/** Per-unit type (per kg / per box / fixed). */
export type CargoChargeType = "kg" | "box" | "fix" | "";

/** Whether this row contributes to the total when summing (somma flag). */
export type CargoChargeSomma = "S" | "N";

export interface CargoChargeRow {
  id: number;
  id_cargo: number;
  tipo: CargoChargeTipo;
  type: CargoChargeType;
  code: string;
  nome: string;
  somma: CargoChargeSomma;
  costo_unit: number;
  costo_min: number;
  costo_max: number;
}

export interface CargoChargeListResponse {
  items: CargoChargeRow[];
  cursor: { next: string | null; limit: number };
}

export interface CargoChargeCreate {
  tipo: CargoChargeTipo;
  type: CargoChargeType;
  code: string;
  nome: string;
  somma?: CargoChargeSomma;
  costo_unit?: number;
  costo_min?: number;
  costo_max?: number;
}

/** Partial update — only the listed fields are accepted by the backend. */
export interface CargoChargePatch {
  costo_unit?: number;
  costo_min?: number;
  costo_max?: number;
  somma?: CargoChargeSomma;
  nome?: string;
  code?: string;
}

/** RFC 7807 problem details — every non-2xx returns this shape. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
