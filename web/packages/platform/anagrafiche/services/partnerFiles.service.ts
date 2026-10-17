import { http } from './http';

export type PartnerFileType = 'logo' | 'privacy' | 'conditions' | 'fuel';

const ENDPOINT = '/api_partner_files';

export const partnerFilesService = {
  async upload(idAnagrafica: number, type: PartnerFileType, file: File): Promise<{ url?: string }> {
    const form = new FormData();
    form.append('id_anagrafica', String(idAnagrafica));
    form.append('type', type);
    form.append('file', file);
    const raw = await http<{ data?: { url?: string }; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: form,
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? {};
  },

  getUrl(idAnagrafica: number, type: PartnerFileType): string {
    const params = new URLSearchParams({ id_anagrafica: String(idAnagrafica), type });
    return `${ENDPOINT}?${params.toString()}`;
  },
};
