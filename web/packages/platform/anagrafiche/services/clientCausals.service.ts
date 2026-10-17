import { http } from './http';

// `fatture_causali_clienti` es un CATÁLOGO GLOBAL de voces de IVA (no por
// cliente). `predefinita` = 'S' marca la voz asignada al cliente consultado
// (anagrafiche.id_causale_IVA). Ver Client_Causals_Controller (backend).
export interface ClientCausal {
  id: number;
  tipo?: string;
  ordine?: number;
  descr?: string;
  descrEN?: string;
  nota_uso?: string;
  aliquota_IVA?: number;
  predefinita?: string;
  [k: string]: unknown;
}

// La causale IVA por defecto del cliente se guarda en anagrafiche.id_causale_IVA.
// La variante '_x3' (dichiarazione d'intenti) NO es una columna de anagrafiche:
// vive en dich_intenti_iva y se gestiona en la sección "Lettere d'intenti"
// (vatDeclarationsService), no aquí.

const ENDPOINT = '/api_client_causals';

export const clientCausalsService = {
  async list(idAnagrafica: number): Promise<ClientCausal[]> {
    const raw = await http<{ data?: ClientCausal[]; items?: ClientCausal[] }>(ENDPOINT, {
      query: { id_anagrafica: idAnagrafica },
    });
    return raw?.data ?? raw?.items ?? [];
  },

  async create(idAnagrafica: number, payload: Partial<ClientCausal>): Promise<ClientCausal | null> {
    const raw = await http<{ data?: ClientCausal; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { ...payload, id_anagrafica: idAnagrafica },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async update(id: number, payload: Partial<ClientCausal>): Promise<ClientCausal | null> {
    const raw = await http<{ data?: ClientCausal; error?: string }>(ENDPOINT, {
      method: 'PATCH',
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
   * Asigna una causale del catálogo como la del cliente
   * (escribe anagrafiche.id_causale_IVA).
   * Es la acción que hace útil la sección: elegir la causale IVA por defecto.
   */
  async assign(idAnagrafica: number, idCausale: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { op: 'assign', id_anagrafica: idAnagrafica, id_causale: idCausale },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
