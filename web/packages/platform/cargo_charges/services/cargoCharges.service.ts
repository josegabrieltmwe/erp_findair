import { http } from '../../anagrafiche/services/http';

/**
 * Catálogo de códigos de charge/suplemento de carga aérea (`cargo_voci`).
 * Réplica moderna de la página legacy `cargovoci.php` (Fase 7/L23).
 *
 * ⚠️ NO es catálogo inerte: `scelta` decide en vivo si el charge se suma al
 * total de una cotización WebCargo — `scelta='S'` = incluido, cualquier
 * otro valor = excluido. Consumido por `Xml_Surcharge_Calculator`,
 * `Webcargo_Rate_Filter_Service`, `Airline_Cache_Service` (con caché
 * propia) y el worker `Webcargo_Hybrid_RPC_Producer`. `E`/`H` son valores
 * válidos según la validación del backend pero ningún consumidor real los
 * distingue entre sí hoy — ambos se comportan igual que "no incluido".
 *
 * Backend: /api_cargo_charges (Cargo_Charge_Controller, modo legacy —
 * extiende Abstract_Cargo_Config_Controller sin `use_rest_mode`) — CRUD
 * completo, sin cambios.
 */

export type CargoChargeTipo = 'A' | 'S';
export type CargoChargeScelta = 'S' | 'E' | 'H' | '';
export type SN = 'S' | 'N';

export interface CargoCharge {
  id: number;
  sigla: string;
  tipo: CargoChargeTipo;
  label_orig: string | null;
  label_ITA: string | null;
  label_ENG: string | null;
  scelta: CargoChargeScelta;
  note: string | null;
  vista: SN;
  stato: 'A' | 'O';
}

export interface CargoChargePayload {
  sigla: string;
  tipo: CargoChargeTipo;
  label_orig: string;
  label_ITA: string;
  label_ENG: string;
  scelta: CargoChargeScelta;
  note: string;
  vista: SN;
}

const BASE = '/api_cargo_charges';

function listOf<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export const cargoChargesService = {
  async list(tipo?: CargoChargeTipo): Promise<CargoCharge[]> {
    const raw = await http<unknown>(BASE, { query: tipo ? { tipo } : {} });
    return listOf<CargoCharge>(raw);
  },

  async create(payload: CargoChargePayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: payload } });
  },

  async update(id: number, payload: CargoChargePayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: { id, ...payload } } });
  },

  async remove(id: number): Promise<void> {
    await http(BASE, { method: 'POST', body: { action: 'delete', item: { id } } });
  },
};
