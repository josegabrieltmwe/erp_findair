import { http } from '../../anagrafiche/services/http';
import type { Paginated } from '../../anagrafiche/services/api.types';
import { paginated } from '../../anagrafiche/services/normalizers';

// `tracking_pubblico` — catálogo de estados de tracking consumido en vivo
// por Shipment_State_Machine_Service (mapea `tipo`→estado de expedición) y
// por ~104 sitios que usan `id` como número mágico (detección de pickup
// vencido, caché "entregado", filtros KPI). Por eso este editor NUNCA
// expone id/tipo/apri_giac como editables ni permite crear filas nuevas —
// el backend (Tracking_Pubblico_Controller) rechaza esas escrituras con
// 400/405 aunque el frontend intentara saltárselo.
export interface TrackingStatus {
  id: number;
  descr_ita?: string | null;
  descr_eng?: string | null;
  descr_spa?: string | null;
  descr_fra?: string | null;
  tipo?: string;
  apri_giac?: string;
  note?: string | null;
  stato?: string;
  [k: string]: unknown;
}

export interface TrackingStatusEditPayload {
  id: number;
  descr_ita?: string;
  descr_eng?: string;
  descr_spa?: string;
  descr_fra?: string;
  note?: string;
}

const ENDPOINT = '/api_master_tracking_statuses';

export const trackingStatusesService = {
  async list(page = 1, search = ''): Promise<Paginated<TrackingStatus>> {
    const raw = await http<unknown>(ENDPOINT, {
      query: { page, per_page: 20, search: search || undefined },
    });
    return paginated<TrackingStatus>(raw);
  },

  async update(payload: TrackingStatusEditPayload): Promise<TrackingStatus | null> {
    const raw = await http<{ data?: TrackingStatus; error?: string }>(ENDPOINT, {
      method: 'PUT',
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  /** Soft-delete (stato='O'). No hay creación — ver docblock de la interfaz. */
  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
