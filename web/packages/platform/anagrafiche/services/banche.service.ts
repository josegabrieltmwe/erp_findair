import { http } from './http';
import type { BancaRow } from './anagrafica.service';

const ENDPOINT = '/api_anagrafica_banks';

export const bancheService = {
  async list(idAnagrafica: number): Promise<BancaRow[]> {
    const raw = await http<{ data?: BancaRow[]; items?: BancaRow[] }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica },
    });
    return raw?.data ?? raw?.items ?? [];
  },

  async create(idAnagrafica: number, payload: Partial<BancaRow>): Promise<BancaRow | null> {
    const raw = await http<{ data?: BancaRow; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { ...payload, id_anagrafica: idAnagrafica },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async update(id: number, payload: Partial<BancaRow>): Promise<BancaRow | null> {
    const raw = await http<{ data?: BancaRow; error?: string }>(ENDPOINT, {
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

  /**
   * Marca un banco como banco por defecto del cliente (anagrafiche.id_banca_def).
   * Paridad legacy "BancaRiBa". Ruta hybrid: api_anagrafica_set_default_bank (PUT).
   */
  async setDefault(idAnagrafica: number, idBanca: number): Promise<void> {
    const raw = await http<{ error?: string }>('/api_anagrafica_set_default_bank', {
      method: 'PUT',
      body: { id_anagrafica: idAnagrafica, id_banca: idBanca },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
