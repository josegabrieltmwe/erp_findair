import { http } from '../../anagrafiche/services/http';

/**
 * Currencies admin (valute). Réplica moderna de la página legacy `valute.php`
 * (`valute_list.php` + `valute_exe_ajax.php`).
 *
 * Backend: /api_master_currencies (Valute_Controller / Web_Valute_Controller)
 *   GET            lista completa (14 monedas, sin paginación real)
 *   GET  ?id=N     un registro
 *   PUT            actualizar (id en body) — SIN POST ni DELETE: el legacy
 *                  nunca ofreció alta/baja real desde la UI de negocio.
 *
 * `cambioEUR` y `data_Cron` son de SOLO LECTURA: Currency_Rate_Update_Service
 * los sobreescribe cada mañana (~7:10) vía cron — el legacy tampoco los
 * exponía a edición manual (valute_exe_ajax.php solo aceptaba
 * cm=sigla|nome|dogana). El backend rechaza un PUT que los toque
 * (readonly_fields en Valute_Controller); esta UI ni los ofrece.
 */

export interface Currency {
  id: number;
  sigla: string;
  nome: string;
  assicurazione: 'S' | 'N';
  dogana: 'S' | 'N';
  contrassegno: 'S' | 'N';
  cambioEUR: number;
  data_Cron: string | null;
}

export interface CurrencyEditablePayload {
  sigla: string;
  nome: string;
  dogana: 'S' | 'N';
}

const ENDPOINT = '/api_master_currencies';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[]; items?: T[] } | null;
  if (Array.isArray(r?.data)) return r!.data as T[];
  if (Array.isArray(r?.items)) return r!.items as T[];
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export const currenciesService = {
  async list(): Promise<Currency[]> {
    const raw = await http<unknown>(ENDPOINT);
    return listOf<Currency>(raw);
  },

  async update(id: number, payload: CurrencyEditablePayload): Promise<void> {
    const raw = await http<RawWrite>(ENDPOINT, {
      method: 'PUT',
      body: { id, ...payload },
    });
    assertOk(raw, 'Update failed');
  },
};
