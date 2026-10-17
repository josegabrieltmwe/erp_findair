import { http } from '../../anagrafiche/services/http';

/**
 * Supplier tracking-code administration. Réplica moderna de las páginas
 * legacy fnt_track (códigos mapeados) y fnt_trackerr (códigos sin mapear).
 *
 * Migrado desde `admin_config/src/features/tracking_codes/` (Fase 1: enlace
 * externo; esta migración lo reemplaza por una ruta nativa de Settings
 * moderno — mismo backend, sin cambios).
 *
 * NB: distinto del seguimiento operativo de expediciones. Esto es la
 * CONFIGURACIÓN del diccionario de códigos de tracking por fornitore
 * (id_fornitore = anagrafica del courier).
 *
 * Backend:
 *   - /api_supplier_tracking_descr (Web_Tracking_Descr_Controller) — fnt_track
 *       GET ?id_fornitore=N              lista enriquecida (join tracking_pubblico)
 *       GET ?op=public_statuses          catálogo de estados públicos (selector)
 *       POST / PUT / DELETE              CRUD (id en body salvo create)
 *   - /api_supplier_tracking_err (Web_Tracking_Descr_Err_Controller) — fnt_trackerr
 *       GET ?id_fornitore=N              lista de códigos sin mapear
 *       POST / PUT / DELETE              CRUD
 *
 * admin_only (sesión).
 */

/** Un mapeo código-fornitore → estado público (fnt_track), con el estado unido. */
export interface TrackingCode {
  id: number;
  id_fornitore: number;
  descr_forn: string;
  id_tracking_pubblico: number;
  note: string | null;
  pub_tipo: string | null;
  pub_apri_giac: 'S' | 'N' | null;
  pub_descr: string | null;
  [k: string]: unknown;
}

/** Un código sin mapear (fnt_trackerr), con metadatos de la clasificación AI. */
export interface UnmappedCode {
  id: number;
  id_fornitore: number;
  descr_forn: string;
  note: string | null;
  contatore: number | null;
  ai_suggested_id_pubblico: number | null;
  ai_suggested_tipo: string | null;
  ai_confidence: number | null;
  ai_review_status: string | null;
  [k: string]: unknown;
}

/** Estado público del catálogo tracking_pubblico (para el selector). */
export interface PublicStatus {
  id: number;
  tipo: string;
  apri_giac: 'S' | 'N';
  description: string;
}

export interface TrackingCodePayload {
  id_fornitore: number;
  descr_forn: string;
  id_tracking_pubblico: number;
  note?: string;
}

export interface UnmappedCodePayload {
  id_fornitore: number;
  descr_forn: string;
  note?: string;
}

const DESCR = '/api_supplier_tracking_descr';
const ERR = '/api_supplier_tracking_err';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const d = (raw as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

export const trackingCodesService = {
  // ── fnt_track: códigos mapeados ──
  async listMapped(idFornitore: number): Promise<TrackingCode[]> {
    const raw = await http<unknown>(DESCR, { query: { id_fornitore: idFornitore } });
    return listOf<TrackingCode>(raw);
  },

  async createMapped(payload: TrackingCodePayload): Promise<void> {
    const raw = await http<RawWrite>(DESCR, { method: 'POST', body: payload });
    assertOk(raw, 'Creazione fallita');
  },

  async updateMapped(id: number, payload: Partial<TrackingCodePayload>): Promise<void> {
    const raw = await http<RawWrite>(DESCR, { method: 'PUT', body: { ...payload, id } });
    assertOk(raw, 'Aggiornamento fallito');
  },

  async removeMapped(id: number): Promise<void> {
    const raw = await http<RawWrite>(DESCR, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Eliminazione fallita');
  },

  /** Catálogo de estados públicos (cualquier tipo) para el selector. */
  async listPublicStatuses(): Promise<PublicStatus[]> {
    const raw = await http<unknown>(DESCR, { query: { op: 'public_statuses' } });
    return listOf<PublicStatus>(raw);
  },

  // ── fnt_trackerr: códigos sin mapear ──
  async listUnmapped(idFornitore: number): Promise<UnmappedCode[]> {
    const raw = await http<unknown>(ERR, { query: { id_fornitore: idFornitore } });
    return listOf<UnmappedCode>(raw);
  },

  async createUnmapped(payload: UnmappedCodePayload): Promise<void> {
    const raw = await http<RawWrite>(ERR, { method: 'POST', body: payload });
    assertOk(raw, 'Creazione fallita');
  },

  async updateUnmapped(id: number, payload: Partial<UnmappedCodePayload>): Promise<void> {
    const raw = await http<RawWrite>(ERR, { method: 'PUT', body: { ...payload, id } });
    assertOk(raw, 'Aggiornamento fallito');
  },

  async removeUnmapped(id: number): Promise<void> {
    const raw = await http<RawWrite>(ERR, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Eliminazione fallita');
  },
};
