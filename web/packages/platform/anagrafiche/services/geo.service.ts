import { http } from './http';

/**
 * Geo lookup CAP → ciudad + provincia + aeropuertos. Envuelve el endpoint
 * cap_city_prov (Cap_City_Prov_Controller, público/hybrid). Portado desde
 * apps/cargo_express/services/geo.service para reutilizar en la ficha de sede
 * y cualquier formulario de dirección del package.
 */
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
  /** Descripción/id de la provincia. false si no se resuelve. */
  prov: string | number | false;
  /** Sigla de la provincia (ej. "BZ"). false si no se resuelve. */
  prov_short: string | false;
  airport: CapCityProvAirport | null;
  closer_airports: CapCityProvAirport[];
  /** Ciudades sugeridas para el CAP dado (puede haber varias por CAP). */
  cities: string[];
  errors: string[] | { [k: string]: unknown };
  /** Lista completa de provincias del país (solo cuando se pasa cap). */
  provinces: Array<{ id: number; sigla: string; descr: string }>;
}

export const geoService = {
  /** cap_city_prov — CAP + provincia + ciudades + aeropuertos cercanos. */
  lookupCap(params: { country: string; cap?: string; departure?: boolean }): Promise<CapCityProvResponse> {
    return http<CapCityProvResponse>('/cap_city_prov', { query: params });
  },
};
