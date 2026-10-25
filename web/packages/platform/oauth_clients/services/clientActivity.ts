import type { OAuthClient } from './oauthClients.service';

/** Días sin actividad a partir de los cuales una app activa se considera latente. */
export const STALE_AFTER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `true` si el client está activo y no se ha usado en `days` días (o nunca).
 * Un client deshabilitado no es "latente": ya está apagado.
 * `last_activity` llega como `YYYY-MM-DD HH:mm:ss` en hora del servidor; para un
 * umbral de meses el desfase horario es irrelevante.
 */
export function isStaleClient(c: OAuthClient, now: number = Date.now(), days: number = STALE_AFTER_DAYS): boolean {
  const active = c.status ? c.status === 'active' : c.stato === 'A';
  if (!active) return false;
  if (!c.last_activity) return true;
  const t = Date.parse(c.last_activity.replace(' ', 'T'));
  if (Number.isNaN(t)) return true;
  return now - t > days * DAY_MS;
}

/** Filtro de texto libre sobre id, nombre, empresa y email de contacto. */
export function matchesClientSearch(c: OAuthClient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.client_id, c.client_name, c.company_name, c.contact_email, c.role_name]
    .some((v) => typeof v === 'string' && v.toLowerCase().includes(q));
}
