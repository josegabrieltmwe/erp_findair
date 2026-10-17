import { http } from '../../anagrafiche/services/http';

/**
 * Cargo ground handlers admin (handlers table). Por partner (aeropuerto/
 * terminal que ofrece el handling) — solo 19 filas activas en 3 partners.
 * NO incluye direcciones del handler (`handlers_sedi`,
 * Handler_Sede_Controller/`api_cargo_handler_addresses`) — dominio anidado
 * separado, fuera de alcance de este lote.
 *
 * Backend: /api_cargo_handlers (Handler_Controller) — modo LEGACY, mismo
 * contrato que Cargo_Carrier_Controller (ver cargoCarriers.service.ts):
 * GET devuelve array plano, alta/edición van en {item:{...}}, borrado en
 * {action:'delete', item:{id}}.
 */

export interface CargoHandler {
  id: number;
  id_partner: number;
  nome: string;
  descr: string | null;
  stato: 'A' | 'O';
}

export interface CargoHandlerPayload {
  id_partner: number;
  nome: string;
  descr: string;
}

const BASE = '/api_cargo_handlers';

function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const d = (raw as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

export const cargoHandlersService = {
  async listByPartner(idPartner: number): Promise<CargoHandler[]> {
    const raw = await http<unknown>(BASE, { query: { id_partner: idPartner } });
    return listOf<CargoHandler>(raw);
  },

  async create(payload: CargoHandlerPayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: payload } });
  },

  async update(id: number, payload: CargoHandlerPayload): Promise<void> {
    await http(BASE, { method: 'POST', body: { item: { id, ...payload } } });
  },

  async remove(id: number): Promise<void> {
    await http(BASE, { method: 'POST', body: { action: 'delete', item: { id } } });
  },
};
