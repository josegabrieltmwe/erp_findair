import { http } from './http';

export type ViesStatus = 'OK' | 'KO' | 'X' | 'NN' | 'ACCESS_DENIED' | 'MISSING_DATA';

export interface ViesResult {
  valid?: boolean;
  vies_status?: ViesStatus;
  name?: string;
  address?: string;
  country?: string;
  updated?: boolean;
}

export interface BulkViesResult {
  checked: number;
  results: Array<{
    id_anagrafica: number;
    status: ViesStatus;
    iso_paese?: string;
  }>;
}

const ENDPOINT = '/api_anagrafica_vies';

export const viesService = {
  async check(payload: { id_anagrafica?: number; iso_paese?: string; partita_iva?: string }): Promise<ViesResult> {
    const raw = await http<{ data?: ViesResult; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? {};
  },

  async bulkCheck(idList: number[]): Promise<BulkViesResult> {
    const raw = await http<{ data?: BulkViesResult; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'bulk_check', id_anagrafica_list: idList },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? { checked: 0, results: [] };
  },
};
