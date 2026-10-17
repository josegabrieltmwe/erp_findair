import { http } from './http';

/**
 * Setting "restringir aeropuertos sugeridos al país de la ruta" por
 * anagrafica (partner o cliente). No es un CRUD de lista -- es un simple
 * get/set de un valor único, con cascada de 3 niveles resuelta en el
 * backend (propio -> partner titular -> global). Backend:
 * /api_admin_partner_airport_restriction
 * (Partner_Airport_Restriction_Admin_Controller), admin-only (TMWE).
 */

export type AirportRestrictionSource = 'own' | 'titolare' | 'global';

export interface AirportRestrictionState {
  id_anagrafica: number;
  /** Valor propio explícito ('S'/'N'), o null si hereda (sin fila propia). */
  own: 'S' | 'N' | null;
  /** Valor efectivo tras resolver la cascada. */
  effective: boolean;
  source: AirportRestrictionSource;
  /** id del partner titular del que proviene el valor, cuando source='titolare'. */
  inherited_from: number | null;
}

interface RawGetResponse {
  success?: boolean;
  data?: AirportRestrictionState;
  error?: string;
}

interface RawSetResponse {
  success?: boolean;
  data?: AirportRestrictionState;
  error?: string;
}

const ENDPOINT = '/api_admin_partner_airport_restriction';

export const airportRestrictionService = {
  async get(idAnagrafica: number): Promise<AirportRestrictionState> {
    const raw = await http<RawGetResponse>(ENDPOINT, { query: { id_anagrafica: String(idAnagrafica) } });
    if (raw?.success === false || !raw?.data) {
      throw new Error(raw?.error || 'Failed to load airport restriction setting');
    }
    return raw.data;
  },

  /** value: 'S' (restringir), 'N' (no restringir), 'inherit' (volver a heredar). */
  async set(idAnagrafica: number, value: 'S' | 'N' | 'inherit'): Promise<AirportRestrictionState> {
    const raw = await http<RawSetResponse>(ENDPOINT, {
      method: 'POST',
      body: { id_anagrafica: idAnagrafica, value },
    });
    if (raw?.success === false || !raw?.data) {
      throw new Error(raw?.error || 'Failed to update airport restriction setting');
    }
    return raw.data;
  },
};
