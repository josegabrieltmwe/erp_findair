import { http } from './http';
import type { LettIntRow } from './anagrafica.service';

const ENDPOINT = '/api_anagrafica_vat_declarations';

export const vatDeclarationsService = {
  async list(idAnagrafica: number): Promise<LettIntRow[]> {
    const raw = await http<{ data?: LettIntRow[]; items?: LettIntRow[] }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica },
    });
    return raw?.data ?? raw?.items ?? [];
  },

  async create(idAnagrafica: number, payload: Partial<LettIntRow>): Promise<LettIntRow | null> {
    const raw = await http<{ data?: LettIntRow; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { ...payload, id_anagrafica: idAnagrafica },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async update(id: number, payload: Partial<LettIntRow>): Promise<LettIntRow | null> {
    const raw = await http<{ data?: LettIntRow; error?: string }>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body: { id, ...payload },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
