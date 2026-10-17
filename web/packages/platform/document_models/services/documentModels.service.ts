import { http } from '../../anagrafiche/services/http';

/**
 * Document/message templates admin (modelli). Réplica moderna de la
 * página legacy `modelli.php`. 347 filas activas — plantillas HTML de
 * mensajes (email/fax/SMS/carta) por partner, multi-idioma.
 *
 * Tenancy (F0 anti-IDOR, ver Modelli_Controller): un partner ve las SUYAS
 * más las BASE de TMWE (id_anagrafica=1, fallback cuando no tiene propia),
 * pero solo puede editar/borrar las suyas — las base son de solo lectura
 * para duplicar, nunca editables directamente. El backend ya impone esto;
 * la UI solo debe respetarlo (deshabilitar edición si `id_anagrafica` no es
 * el del partner de sesión — lo determina el propio backend rechazando el
 * PUT/DELETE, no hace falta duplicar la lógica en el cliente).
 *
 * Seguridad: `html` es contenido de plantilla libre. El preview se muestra
 * en un <iframe sandbox> SIN `allow-scripts`, nunca con `v-html` directo en
 * el DOM de la página — evita que un `<script>` guardado en una plantilla
 * se ejecute en el contexto de la SPA.
 *
 * Backend: /api_master_templates (Modelli_Controller) — CRUD REST completo.
 */

export type Lingua = 'ITA' | 'ENG' | 'SPA' | 'FRA';
export type Flag = 'S' | 'N';

export interface DocumentModel {
  id: number;
  tipo: string | null;
  id_anagrafica: number;
  html_purify: Flag;
  lingua: Lingua;
  descriz: string | null;
  oggetto: string | null;
  html: string | null;
  mail: Flag;
  fax: Flag;
  sms: Flag;
  carta: Flag;
  mittente_msg: string | null;
  stato: 'A' | 'O';
}

export interface DocumentModelPayload {
  tipo: string;
  html_purify: Flag;
  lingua: Lingua;
  descriz: string;
  oggetto: string;
  html: string;
  mail: Flag;
  fax: Flag;
  sms: Flag;
  carta: Flag;
  mittente_msg: string;
}

const BASE = '/api_master_templates';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[] } | null;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
}

export const documentModelsService = {
  async list(): Promise<DocumentModel[]> {
    const raw = await http<unknown>(BASE);
    return listOf<DocumentModel>(raw);
  },

  async create(payload: DocumentModelPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: DocumentModelPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
