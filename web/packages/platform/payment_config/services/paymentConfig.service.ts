import { http } from '../../anagrafiche/services/http';

/**
 * Payment methods (pagamenti_metodi_new) and payment terms / schedules
 * (pagamenti_scad_new). Migrated from V1 `payment_config.js`.
 *
 * Backend:
 *   - GET/POST/PUT/DELETE /api_payment_methods    (Web_Payment_Method_Controller)
 *   - GET/POST/PUT/DELETE /api_payment_schedules  (Web_Payment_Schedule_Controller)
 *
 * `id_anagrafica` is injected server-side from the authenticated partner; the
 * client never sends it. The schedule GET response is enriched by the backend
 * with `installments[]`, `nrate` and `label`.
 */

export type PaymentMethodType = 'P' | 'A' | 'E'; // Payment | Income | Both

export interface PaymentMethod {
  id: number;
  descr: string;
  descrEN?: string | null;
  tipo: PaymentMethodType;
  xml_code?: string | null;
  orderby?: number;
  [k: string]: unknown;
}

export interface PaymentMethodPayload {
  id?: number;
  descr: string;
  descrEN?: string;
  tipo: PaymentMethodType;
  xml_code?: string;
  orderby?: number;
}

/** Day brackets exposed as gg0..gg360 enum('S','N') on the schedule row. */
export const GG_BRACKETS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360] as const;

export interface PaymentSchedule {
  id: number;
  ggmese?: number;
  clienti?: 'S' | 'N';
  orderby?: number;
  // Enriched (read-only) fields returned by the backend GET.
  label?: string;
  nrate?: number;
  installments?: number[];
  end_of_month?: boolean;
  // gg0..gg360 enum('S','N')
  [k: `gg${number}`]: 'S' | 'N' | undefined;
  [k: string]: unknown;
}

export interface PaymentSchedulePayload {
  id?: number;
  ggmese?: number;
  clienti?: 'S' | 'N';
  orderby?: number;
  // gg0..gg360 flags spread in by the caller.
  [k: string]: unknown;
}

interface RawListResponse<T> {
  success?: boolean;
  data?: T[];
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  data?: unknown;
}

const METHODS_ENDPOINT = '/api_payment_methods';
const SCHEDULES_ENDPOINT = '/api_payment_schedules';

function asArray<T>(raw: RawListResponse<T> | undefined, fallbackMsg: string): T[] {
  if (raw?.success === false) throw new Error(raw.error || fallbackMsg);
  return Array.isArray(raw?.data) ? raw!.data! : [];
}

export const paymentConfigService = {
  // ── Methods ──
  async listMethods(tipo?: PaymentMethodType): Promise<PaymentMethod[]> {
    const query: Record<string, string> = {};
    if (tipo) query.tipo = tipo;
    const raw = await http<RawListResponse<PaymentMethod>>(METHODS_ENDPOINT, { query });
    return asArray(raw, 'Failed to load payment methods');
  },

  async createMethod(payload: PaymentMethodPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(METHODS_ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async updateMethod(payload: PaymentMethodPayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(METHODS_ENDPOINT, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: payload,
    });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async removeMethod(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(METHODS_ENDPOINT, {
      method: 'DELETE',
      query: { id: String(id) },
      body: { id },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },

  // ── Schedules ──
  async listSchedules(): Promise<PaymentSchedule[]> {
    const raw = await http<RawListResponse<PaymentSchedule>>(SCHEDULES_ENDPOINT);
    return asArray(raw, 'Failed to load payment terms');
  },

  async createSchedule(payload: PaymentSchedulePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(SCHEDULES_ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async updateSchedule(payload: PaymentSchedulePayload): Promise<void> {
    if (!payload.id) throw new Error('Missing id');
    const raw = await http<RawWriteResponse>(SCHEDULES_ENDPOINT, {
      method: 'PUT',
      query: { id: String(payload.id) },
      body: payload,
    });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async removeSchedule(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(SCHEDULES_ENDPOINT, {
      method: 'DELETE',
      query: { id: String(id) },
      body: { id },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
