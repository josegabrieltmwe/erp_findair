import { http } from './http';

export interface RemoteZoneCheckRequest {
  country: string;
  cap?: string;
  city?: string;
  /** Opaque echo field (x1 destination, x2 pickup). */
  which?: 'x1' | 'x2' | string;
}

export interface RemoteZoneCheckResponse {
  success: boolean;
  remote: 'S' | 'N';
  which: string;
  error?: string;
}

export interface CapCityProvAirport {
  sigla: string;
  label?: string;
  iso?: string;
  distance?: number;
  location?: { lat: string; lon: string };
}

export interface CapCityProvResponse {
  cap: string | null;
  iso: string | false;
  id_reg: number | false;
  /** Province description (e.g. "Bolzano"). False when not resolved. */
  prov: string | number | false;
  /** Province sigla (e.g. "BZ"). False when not resolved. */
  prov_short: string | false;
  /** First-airport object, NOT a bare IATA string. */
  airport: CapCityProvAirport | null;
  closer_airports: CapCityProvAirport[];
  /** Suggested cities for the given CAP. */
  cities: string[];
  errors: string[] | { [k: string]: unknown };
  provinces: Array<{ id: number; sigla: string; descr: string }>;
}

export const geoService = {
  /** ajax_remote_zone_check — fast remote-area detection by (country, cap|city). */
  isRemote(req: RemoteZoneCheckRequest): Promise<RemoteZoneCheckResponse> {
    return http<RemoteZoneCheckResponse>('/api_remote_zone_check_compat', { query: req });
  },

  /** cap_city_prov — CAP + province + closer airports (legacy autocomplete bundle). */
  lookupCap(params: { country: string; cap?: string; departure?: boolean }): Promise<CapCityProvResponse> {
    return http<CapCityProvResponse>('/cap_city_prov', { query: params });
  },
};
