import { http } from '../../anagrafiche/services/http';
import { unwrap, paginated } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * Geographic configuration: countries (paesi_iso), delivery zone assignments
 * (paesi_zone) and country groups (paesi_gruppi). Migrated from V1
 * `geographic_config.js`.
 *
 * Backend:
 *   - /api_master_countries       (Web_Paesi_Iso_Controller — Abstract_Master_Data CRUD)
 *   - /api_master_country_zones   (Web_Paesi_Zone_Controller — Abstract_Master_Data CRUD)
 *   - /api_master_country_groups  (Web_Country_Group_Controller — custom shape)
 *
 * The CRUD controllers wrap write payloads in `{ item: {...} }` and accept the
 * `id` as a query param on PUT/DELETE. The country-groups controller uses a
 * flat body and a bespoke `{ groups: [] }` / `{ group: { members } }` shape.
 */

// ── Countries ──
export interface Country {
  id: number;
  ISO?: string;
  ISO2?: string;
  nome?: string;
  nomeEN?: string;
  CEE?: 'S' | 'N';
  add_days?: number;
  add_days_par?: number;
  mostra?: 'S' | 'N';
  usa_cap?: string;
  usa_prov?: string;
  [k: string]: unknown;
}

export interface CountryUpdatePayload {
  id: number;
  nome?: string;
  nomeEN?: string;
  CEE?: 'S' | 'N';
  add_days?: number;
  add_days_par?: number;
  mostra?: 'S' | 'N';
  usa_cap?: string;
  usa_prov?: string;
}

// ── Zones ──
export interface CountryZone {
  id: number;
  from_paese_iso?: string;
  id_paese_iso?: string;
  id_fornitore?: string | number;
  id_servizi_forn?: string | number;
  zona?: number;
  tempi?: number;
  nota_zona?: string | null;
  [k: string]: unknown;
}

export interface CountryZonePayload {
  id?: number;
  from_paese_iso: string;
  id_paese_iso: string;
  id_fornitore?: string | number;
  id_servizi_forn: string | number;
  zona: number;
  tempi?: number;
  nota_zona?: string;
}

export interface ZoneFilters {
  from_paese_iso?: string;
  id_servizi_forn?: string;
}

export interface CountrySubzone {
  id: number;
  from_rec?: string;
  from_paese_iso?: string;
  id_paese_iso?: string;
  gruppo?: string | number;
  id_fornitore?: string | number;
  id_servizi_forn?: string | number;
  zona?: number;
  nota_zona?: string | null;
  prov?: string | null;
  cap_list?: string | null;
  cap_ko?: string | null;
  bidirez?: string;
  invpresa?: string;
  tempi?: number;
  [k: string]: unknown;
}

export interface CountrySubzonePayload {
  id?: number;
  from_rec?: string;
  from_paese_iso: string;
  id_paese_iso: string;
  id_servizi_forn: string | number;
  zona: number;
  nota_zona?: string;
  prov?: string;
  gruppo?: number;
  cap_list?: string;
  cap_ko?: string;
  bidirez?: string;
  invpresa?: string;
  tempi?: number;
}

export interface SubzoneFilters {
  from_paese_iso?: string;
  id_servizi_forn?: string;
}

// ── Country groups ──
export interface CountryGroupMember {
  id: number;
  ISO?: string;
  nome?: string;
  [k: string]: unknown;
}

export interface CountryGroup {
  id: number;
  nome?: string;
  nome_EN?: string;
  help?: string;
  help_EN?: string;
  orderby?: number;
  member_count?: number;
  members?: CountryGroupMember[];
  [k: string]: unknown;
}

export interface CountryGroupPayload {
  id?: number;
  nome: string;
  nome_EN?: string;
  help?: string;
  help_EN?: string;
  orderby?: number;
}

// ── Remote / KO areas (aree_ko_remote) ──
export interface RemoteArea {
  id: number;
  id_fornitore?: string | number;
  iso?: string;
  citta?: string;
  cap?: string;
  tipo?: 'KO' | 'RM';
  [k: string]: unknown;
}

export interface RemoteAreaPayload {
  id?: number;
  id_fornitore: string | number;
  iso: string;
  citta?: string;
  cap?: string;
  tipo: 'KO' | 'RM';
}

export interface RemoteAreaFilters {
  id_fornitore?: string | number;
  iso?: string;
  tipo?: 'KO' | 'RM';
}

const COUNTRIES = '/api_master_countries';
const ZONES = '/api_master_country_zones';
const SUBZONES = '/api_master_country_subzones';
const GROUPS = '/api_master_country_groups';
const REMOTE_AREAS = '/api_master_remote_areas';

interface RawWriteResponse {
  success?: boolean;
  error?: string;
}

function assertOk(raw: RawWriteResponse | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

export const geographicConfigService = {
  // ── Countries ──
  async listCountries(): Promise<Country[]> {
    const raw = await http<unknown>(COUNTRIES, { query: { per_page: 300 } });
    const arr = unwrap<Country[]>(raw);
    return Array.isArray(arr) ? arr : [];
  },

  async updateCountry(payload: CountryUpdatePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(COUNTRIES, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: { item: payload },
    });
    assertOk(raw, 'Update failed');
  },

  // ── Zones ──
  async listZones(page: number, filters: ZoneFilters = {}): Promise<Paginated<CountryZone>> {
    const query: Record<string, string | number> = { page, per_page: 30 };
    if (filters.from_paese_iso) query.from_paese_iso = filters.from_paese_iso;
    if (filters.id_servizi_forn) query.id_servizi_forn = filters.id_servizi_forn;
    const raw = await http<unknown>(ZONES, { query });
    return paginated<CountryZone>(raw);
  },

  async createZone(payload: CountryZonePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ZONES, { method: 'POST', body: { item: payload } });
    assertOk(raw, 'Create failed');
  },

  async updateZone(payload: CountryZonePayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(ZONES, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: { item: payload },
    });
    assertOk(raw, 'Update failed');
  },

  async removeZone(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ZONES, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },

  // ── Route subzones (paesi_zone_sub) ──
  async listSubzones(page: number, filters: SubzoneFilters = {}): Promise<Paginated<CountrySubzone>> {
    const query: Record<string, string | number> = { page, per_page: 30 };
    if (filters.from_paese_iso) query.from_paese_iso = filters.from_paese_iso;
    if (filters.id_servizi_forn) query.id_servizi_forn = filters.id_servizi_forn;
    const raw = await http<unknown>(SUBZONES, { query });
    return paginated<CountrySubzone>(raw);
  },

  async createSubzone(payload: CountrySubzonePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(SUBZONES, { method: 'POST', body: { item: payload } });
    assertOk(raw, 'Create failed');
  },

  async updateSubzone(payload: CountrySubzonePayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(SUBZONES, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: { item: payload },
    });
    assertOk(raw, 'Update failed');
  },

  async removeSubzone(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(SUBZONES, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },

  // ── Country groups (bespoke shape) ──
  async listGroups(): Promise<CountryGroup[]> {
    const raw = await http<{ success?: boolean; error?: string; groups?: CountryGroup[] }>(GROUPS);
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load groups');
    return Array.isArray(raw?.groups) ? raw!.groups! : [];
  },

  async getGroupMembers(id: number): Promise<CountryGroupMember[]> {
    const raw = await http<{ group?: { members?: CountryGroupMember[] } }>(GROUPS, {
      query: { id: String(id) },
    });
    return Array.isArray(raw?.group?.members) ? raw!.group!.members! : [];
  },

  async createGroup(payload: CountryGroupPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(GROUPS, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async updateGroup(payload: CountryGroupPayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(GROUPS, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: payload,
    });
    assertOk(raw, 'Update failed');
  },

  async removeGroup(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(GROUPS, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },

  // ── Remote / KO areas (aree_ko_remote) ──
  async listRemoteAreas(page: number, filters: RemoteAreaFilters = {}): Promise<Paginated<RemoteArea>> {
    const query: Record<string, string | number> = { page, per_page: 30 };
    if (filters.id_fornitore) query.id_fornitore = String(filters.id_fornitore);
    if (filters.iso) query.iso = filters.iso;
    if (filters.tipo) query.tipo = filters.tipo;
    const raw = await http<unknown>(REMOTE_AREAS, { query });
    return paginated<RemoteArea>(raw);
  },

  async createRemoteArea(payload: RemoteAreaPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(REMOTE_AREAS, { method: 'POST', body: { item: payload } });
    assertOk(raw, 'Create failed');
  },

  async updateRemoteArea(payload: RemoteAreaPayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(REMOTE_AREAS, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: { item: payload },
    });
    assertOk(raw, 'Update failed');
  },

  async removeRemoteArea(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(REMOTE_AREAS, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },
};
