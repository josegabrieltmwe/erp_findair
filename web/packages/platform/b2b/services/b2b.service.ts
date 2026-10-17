import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

export type B2bConfig = Record<string, string | number | boolean | null>;

export const b2bService = {
  async get(idAnagrafica: number): Promise<B2bConfig> {
    const raw = await http<unknown>('/api_b2b_config', { query: { id_anagrafica: idAnagrafica } });
    return unwrap<B2bConfig>(raw);
  },

  async update(idAnagrafica: number, payload: B2bConfig): Promise<B2bConfig> {
    const body = { ...payload, id_anagrafica: idAnagrafica };
    const raw = await http<unknown>('/api_b2b_config', {
      method: 'PUT',
      body,
    });
    return unwrap<B2bConfig>(raw);
  },
};
