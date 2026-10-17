import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';

/**
 * Avisos del sitio B2B (banner que ven los clientes). Backend:
 * /api_avviso_sito (Avviso_Sito_Controller, auth hibrida) — GET lista
 * (cada socio ve los suyos; TMWE ve todos) / GET ?id / POST / PUT (id en el
 * body) / DELETE ?id (borrado fisico, la tabla no tiene `stato`).
 * El backend sanea `testo` con una lista de etiquetas permitidas; aqui se
 * replica solo para la vista previa.
 */

export interface SiteNotice {
  id: number;
  id_anagr_titolare: number | null;
  data_start: string | null;
  data_stop: string | null;
  testo: string;
  insert_datetime?: string | null;
}

export interface SiteNoticePayload {
  data_start: string;
  data_stop: string;
  testo: string;
}

export type NoticeState = 'active' | 'scheduled' | 'expired';

const BASE = '/api_avviso_sito';

/** 'YYYY-MM-DD HH:MM:SS' (o ISO) -> epoch ms; null si vacio o invalido. */
export function parseNoticeDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || s.startsWith('0000')) return null;
  const ms = new Date(s.replace(' ', 'T')).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Estado en `now`: sin fecha de inicio/fin se considera abierto por ese lado. */
export function noticeState(
  n: Pick<SiteNotice, 'data_start' | 'data_stop'>,
  now: number = Date.now(),
): NoticeState {
  const start = parseNoticeDate(n.data_start);
  const stop = parseNoticeDate(n.data_stop);
  if (start !== null && now < start) return 'scheduled';
  if (stop !== null && now > stop) return 'expired';
  return 'active';
}

/** Valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm) desde el valor del backend. */
export function toInputValue(value: string | null | undefined): string {
  const ms = parseNoticeDate(value);
  if (ms === null) return '';
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 'YYYY-MM-DDTHH:mm' -> 'YYYY-MM-DD HH:mm:00' (formato datetime del backend). */
export function fromInputValue(value: string): string {
  const v = (value || '').trim();
  if (!v) return '';
  const s = v.replace('T', ' ');
  return s.length === 16 ? `${s}:00` : s;
}

/** Texto visible sin etiquetas (para saber si el aviso esta realmente vacio). */
export function plainText(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

export type NoticeErrorKey = 'text_required' | 'stop_before_start';

/** Devuelve la clave del primer error de validacion, o null si es valido. */
export function validateNotice(p: SiteNoticePayload): NoticeErrorKey | null {
  if (!plainText(p.testo)) return 'text_required';
  const start = parseNoticeDate(p.data_start);
  const stop = parseNoticeDate(p.data_stop);
  if (start !== null && stop !== null && stop <= start) return 'stop_before_start';
  return null;
}

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'a', 'ul', 'ol', 'li', 'span']);

/**
 * Misma lista de etiquetas que el backend. Se descartan las demas (se conserva
 * su texto interior), todos los atributos salvo `href` http(s)/mailto en <a>,
 * y los bloques script/style completos.
 */
export function sanitizeNoticeHtml(html: string): string {
  const cleaned = (html || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  return cleaned.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, slash: string, name: string, attrs: string) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (slash) return `</${tag}>`;
    if (tag === 'a') {
      const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = (href?.[2] ?? href?.[3] ?? '').trim();
      if (/^(https?:\/\/|mailto:)/i.test(url)) {
        return `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
      }
      return '<a>';
    }
    return tag === 'br' ? '<br>' : `<${tag}>`;
  });
}

interface RawWrite {
  success?: boolean;
  error?: string;
  message?: string;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || raw.message || fallback);
}

export const siteNoticesService = {
  async list(): Promise<SiteNotice[]> {
    const raw = await http<unknown>(BASE, { query: { limit: 200 } });
    return paginated<SiteNotice>(raw).items;
  },

  async create(payload: SiteNoticePayload): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'POST', body: payload }), 'Create failed');
  },

  async update(id: number, payload: SiteNoticePayload): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } }), 'Update failed');
  },

  async remove(id: number): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'DELETE', query: { id: String(id) } }), 'Delete failed');
  },
};
