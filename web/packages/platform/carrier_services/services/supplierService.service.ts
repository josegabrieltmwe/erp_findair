import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * Carrier (supplier) services — servizi_forn definitions, their supplements
 * (servizi_forn_suppl) and zone assignments (read-only). Migrated from V1
 * `carrier_services.js`.
 *
 * Backend:
 *   - GET/POST /api_supplier_services              (list/get/create/update/clone/delete)
 *   - GET/POST /api_supplier_service_supplements   (list/create/update)
 *   - GET      /api_supplier_zones                 (paginated, read-only)
 *
 * Write payloads are wrapped in `{ item: {...} }`; clone/delete use
 * `{ action: 'clone'|'delete', ... }`. Response shapes vary (array, `{data}`,
 * `{items}`) and are normalised here.
 */

export type ServiceTipo = 'EXP' | 'AIR' | 'SEA';
export type ServiceWay = 'A' | 'T';
export type ServiceGeozona = 'IT' | 'CE' | 'EX' | 'NA';
export type ServicePriority = 'N' | 'S' | 'E' | 'C';

export interface CarrierService {
  id: number;
  descr?: string;
  id_fornitore?: number | string;
  tipo?: ServiceTipo;
  way?: ServiceWay;
  from_paese_iso?: string;
  geozona?: ServiceGeozona;
  zone_subzone?: string;
  prioritario?: ServicePriority;
  tempi?: number;
  ore?: number;
  fuel_surc?: number;
  coefficiente?: number;
  master?: string;
  manuale?: string;
  lst_gest?: string;
  stato?: string;
  [k: string]: unknown;
}

export interface CarrierServicePayload {
  id?: number;
  descr?: string;
  id_fornitore?: number | string;
  tipo?: ServiceTipo;
  way?: ServiceWay;
  from_paese_iso?: string;
  geozona?: ServiceGeozona;
  zone_subzone?: string;
  prioritario?: ServicePriority;
  tempi?: number;
  ore?: number;
  fuel_surc?: number;
  coefficiente?: number;
  master?: string;
  manuale?: string;
  lst_gest?: string;
  [k: string]: unknown;
}

export interface ServiceSupplement {
  id?: number;
  id_servizio: number;
  id_suppl?: number | string;
  peso_min?: number;
  peso_max?: number;
  orderby?: number;
  stato?: string;
  [k: string]: unknown;
}

export interface ServiceZone {
  id: number;
  from_paese_iso?: string;
  id_paese_iso?: string;
  zona?: number;
  tempi?: number;
  nota_zona?: string | null;
  bidirez?: string;
  // Solo subzonas (paesi_zone_sub, zone_subzone='SUB'). prov/cap_show/cap_ko
  // llegan ya en formato "humano" (lista separada por coma, rangos "da>a" en
  // CAP) — la conversión al formato interno con cap_list expandido la hace
  // el backend (Paesi_Zone_Sub_Controller/Sub_Zone_Format_Service). Nunca
  // editar cap_list directamente, no se expone aquí.
  from_rec?: string;
  gruppo?: number;
  prov?: string | null;
  cap_show?: string | null;
  cap_ko?: string | null;
  invpresa?: string;
  [k: string]: unknown;
}

export interface SubzonePayload {
  id?: number;
  zona?: number;
  tempi?: number;
  nota_zona?: string;
  prov?: string;
  cap_show?: string;
  cap_ko?: string;
}

const SERVICES = '/api_supplier_services';
const SUPPLEMENTS = '/api_supplier_service_supplements';
const ZONES = '/api_supplier_zones_web';
const ZONES_MASTER = '/api_master_country_zones';
const SUBZONES = '/api_master_country_subzones';

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  data?: unknown;
  result?: unknown;
}

/** Collapses array / `{data}` / `{items}` list dialects into a plain array. */
function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const o = raw as { data?: unknown; items?: unknown };
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.items)) return o.items as T[];
  }
  return [];
}

function asObject<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  if (raw && typeof raw === 'object') {
    const o = raw as { data?: unknown };
    if (o.data && typeof o.data === 'object') return o.data as T;
    return raw as T;
  }
  return null;
}

function assertOk(raw: RawWriteResponse | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
  if (raw?.error) throw new Error(raw.error);
}

export const supplierServiceService = {
  // ── Services ──
  async listByFornitore(idFornitore: number | string): Promise<CarrierService[]> {
    const raw = await http<unknown>(SERVICES, { query: { id_fornitore: String(idFornitore) } });
    return asArray<CarrierService>(raw);
  },

  async getById(id: number): Promise<CarrierService | null> {
    const raw = await http<unknown>(SERVICES, { query: { id: String(id) } });
    return asObject<CarrierService>(raw);
  },

  /** Search by description — used by autocomplete-style selectors. */
  async search(query: string, perPage = 25): Promise<CarrierService[]> {
    const raw = await http<unknown>(SERVICES, {
      query: { search: query, per_page: perPage },
    });
    return asArray<CarrierService>(raw);
  },

  async create(item: CarrierServicePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(SERVICES, { method: 'POST', body: { item } });
    assertOk(raw, 'Create failed');
  },

  async update(item: CarrierServicePayload): Promise<void> {
    if (!item.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(SERVICES, { method: 'POST', body: { item } });
    assertOk(raw, 'Update failed');
  },

  async clone(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(SERVICES, {
      method: 'POST',
      body: { action: 'clone', id },
    });
    assertOk(raw, 'Clone failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(SERVICES, {
      method: 'POST',
      body: { action: 'delete', item: { id } },
    });
    assertOk(raw, 'Delete failed');
  },

  // ── Supplements ──
  async listSupplements(idServizio: number): Promise<ServiceSupplement[]> {
    const raw = await http<unknown>(SUPPLEMENTS, { query: { id_servizio: String(idServizio) } });
    return asArray<ServiceSupplement>(raw);
  },

  async saveSupplement(item: ServiceSupplement): Promise<void> {
    const raw = await http<RawWriteResponse>(SUPPLEMENTS, { method: 'POST', body: { item } });
    assertOk(raw, 'Save failed');
  },

  // ── Zones (paginated; listZones=read-only, listSubzones filas editables vía updateSubzone) ──
  async listZones(idServizioForn: number, page = 1): Promise<Paginated<ServiceZone>> {
    const raw = await http<unknown>(ZONES, {
      query: { id_servizi_forn: String(idServizioForn), page, per_page: 20 },
    });
    return paginated<ServiceZone>(raw);
  },

  /** Subzonas (paesi_zone_sub) de un servizio SUB (ruta país→país). */
  async listSubzones(idServizioForn: number, page = 1): Promise<Paginated<ServiceZone>> {
    const raw = await http<unknown>(SUBZONES, {
      query: { id_servizi_forn: String(idServizioForn), page, per_page: 20 },
    });
    return paginated<ServiceZone>(raw);
  },

  /**
   * Actualiza una fila de subzona (zona/tempi/nota_zona/prov/cap_show/
   * cap_ko de una fila `from_rec='N'`). prov/cap_show/cap_ko se envían en
   * formato "humano" (lista separada por coma, rangos "da>a" en CAP); el
   * backend deriva cap_list. Ver Sub_Zone_Format_Service para el porqué de
   * no exponer cap_list nunca desde el frontend.
   */
  async updateSubzone(payload: SubzonePayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(SUBZONES, { method: 'PUT', body: payload });
    assertOk(raw, 'Update failed');
  },

  // ── Clonado de zonas entre servicios (paridad legacy paesi_zone_clona / sub_copy) ──
  /**
   * Clona TODAS las zonas (normales o subzonas) de un servizio origen al destino.
   * Reemplaza las del destino (soft-delete + copia). `sub=true` → paesi_zone_sub.
   * Devuelve el nº de filas copiadas.
   */
  async cloneZones(sourceServizioId: number, targetServizioId: number, sub = false): Promise<number> {
    const endpoint = sub ? SUBZONES : ZONES_MASTER;
    const raw = await http<RawWriteResponse & { data?: { copied?: number } }>(endpoint, {
      method: 'POST',
      body: { op: 'clone', source_servizio_id: sourceServizioId, target_servizio_id: targetServizioId },
    });
    assertOk(raw, 'Clone failed');
    return Number((raw?.data as { copied?: number })?.copied ?? 0);
  },

  // ── Clonado de suplementos entre servicios (G5) ──
  /**
   * Copia TODAS las reglas de suplemento de un servizio origen al destino.
   * `replace=true` reemplaza las del destino (soft-delete + copia).
   * Devuelve el nº de reglas copiadas. Backend: Supplier_Supplement_Controller
   * action=clone → Supplier_Supplement_Model::clone_supplements.
   */
  async cloneSupplements(sourceServizioId: number, targetServizioId: number, replace = true): Promise<number> {
    const raw = await http<RawWriteResponse & { data?: { supplements_cloned?: number } }>(SUPPLEMENTS, {
      method: 'POST',
      body: {
        action: 'clone',
        source_servizio_id: sourceServizioId,
        target_servizio_id: targetServizioId,
        replace,
      },
    });
    assertOk(raw, 'Clone failed');
    return Number((raw?.data as { supplements_cloned?: number })?.supplements_cloned ?? 0);
  },
};
