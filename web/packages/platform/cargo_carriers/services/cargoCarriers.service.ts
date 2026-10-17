import { http } from '../../anagrafiche/services/http';

/**
 * Cargo carriers admin (cargo_vettori). Réplica moderna de la página legacy
 * `cargovett.php`. Catálogo de aerolíneas/navieras usadas en cotización y
 * booking de cargo — 359 filas activas.
 *
 * Modelo canónico: `model/cargo_config/Cargo_Carrier_Model.php` (el propio
 * docblock aclara que `model/cargo/Cargo_Vettori.php` es un modelo de
 * lookup legacy distinto, no el CRUD de config).
 *
 * Backend: /api_cargo_carriers (Cargo_Carrier_Controller) — modo LEGACY
 * (Abstract_Crud_Controller con use_rest_mode=false, no sobreescrito): el
 * GET devuelve un array plano de filas (sin envoltura `{data:[...]}`), el
 * alta/edición van en `{item:{...}}`, el borrado en `{action:'delete',
 * item:{id}}`.
 *   GET ?id=N / GET ?sigla=XX / GET ?tipo=A|S / GET (todos activos)
 *   POST {item:{...}} crear/actualizar / POST {action:'delete', item:{id}}
 */

export type CarrierTipo = 'A' | 'S';
export type Flag = 'S' | 'N';

export interface CargoCarrier {
  id: number;
  sigla: string;
  logo: Flag;
  tipo: CarrierTipo;
  nome_orig: string;
  nome: string | null;
  ignora: Flag;
  ignora_b2b: Flag;
  rated_agreed: Flag;
  vista: Flag;
  stato: 'A' | 'O';
}

export interface CargoCarrierPayload {
  sigla: string;
  logo: Flag;
  tipo: CarrierTipo;
  nome_orig: string;
  nome: string;
  ignora: Flag;
  ignora_b2b: Flag;
  rated_agreed: Flag;
  vista: Flag;
}

const BASE = '/api_cargo_carriers';

/**
 * Modo legacy: un error de validación llega como HTTP 400 con el cuerpo
 * `{campo: "mensaje"}` (Abstract_Crud_Controller::handle_validation_error),
 * no como `{success:false}` — el cliente http() ya lanza en no-2xx, así que
 * no hace falta chequear un campo `success` que este controller no emite.
 */
function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const d = (raw as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

export const cargoCarriersService = {
  async list(tipo?: CarrierTipo): Promise<CargoCarrier[]> {
    const raw = await http<unknown>(BASE, { query: tipo ? { tipo } : {} });
    return listOf<CargoCarrier>(raw);
  },

  async create(payload: CargoCarrierPayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: payload } });
  },

  async update(id: number, payload: CargoCarrierPayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: { id, ...payload } } });
  },

  async remove(id: number): Promise<void> {
    await http(BASE, { method: 'POST', body: { action: 'delete', item: { id } } });
  },
};
