import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Autoservicio de clients OAuth2 propios (`/portal_my_clients`, backend
 * `Portal_My_Clients_Controller`, policy `public_oauth`: cualquier cliente
 * OAuth autenticado, sin scope ni rol admin). Distinto del admin
 * (`oauthClients.service.ts` → /api_admin_external_client*, ve TODOS los
 * clients de TODOS los usuarios, con tier/scopes/IPs editables): este
 * endpoint solo ve y toca los clients del usuario autenticado y NUNCA deja
 * editar tier/scopes/allowed_ips (los hereda del primer client o del rol
 * activo de la persona — ver comentario de la clase en el backend).
 *
 * Solo disponible en ERPs sandbox/dev (`portal_self_service.enabled`); en
 * producción el GET devuelve 403 con un mensaje explicativo que la UI debe
 * mostrar tal cual (ver `isSelfServiceDisabledError`).
 *
 * El `client_secret` solo viaja en la respuesta de `create`/`rotate`, UNA
 * vez — nunca en el listado. La UI debe mostrarlo en un diálogo "cópialo
 * ahora" y no debe guardarlo en ningún store persistente ni loguearlo.
 */

export type PortalClientStatus = 'active' | 'disabled';

export interface PortalOAuthClient {
  id: number;
  client_id: string;
  client_name: string;
  company_name: string;
  contact_email: string;
  tier: string;
  scopes: string[];
  status: PortalClientStatus;
  last_activity_at: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string | null;
}

export interface PortalClientLimits {
  /** Tope total de clients (activos + deshabilitados) por usuario. */
  max_clients_per_user: number;
  /** Tope de creaciones por hora. El backend no expone cuántas van consumidas
   *  de esta ventana — solo el tope — así que la UI no puede pintar un
   *  contador en vivo ("3/5"), solo el tope y reaccionar al 429 si se agota. */
  create_rate_limit_per_hour: number;
}

export interface PortalClientListResult {
  count: number;
  limits: PortalClientLimits;
  clients: PortalOAuthClient[];
}

export interface PortalClientCreatePayload {
  client_name?: string;
  company_name?: string;
  contact_email?: string;
}

export interface PortalClientCreateResult {
  id: number;
  client_id: string;
  client_secret: string;
  client_name: string;
  scopes: string[];
  warning: string;
}

export interface PortalClientRotateResult {
  id: number;
  client_id: string;
  client_secret: string;
  warning: string;
}

export interface PortalClientUpdateMetadataPayload {
  client_name?: string;
  company_name?: string;
  contact_email?: string;
}

interface RawListResponse {
  success?: boolean;
  count?: number;
  limits?: PortalClientLimits;
  clients?: PortalOAuthClient[];
}

interface RawWriteResponse {
  success?: boolean;
  [k: string]: unknown;
}

const ENDPOINT = '/portal_my_clients';

/** `true` si la respuesta es el 403 "disabled in production" del controlador. */
export function isSelfServiceDisabledError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403;
}

/** `true` si la respuesta es el 429 de rate-limit (creación) o soft cap. */
export function isRateLimitedError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 429;
}

export const portalMyClientsService = {
  async list(): Promise<PortalClientListResult> {
    const raw = await http<RawListResponse>(ENDPOINT);
    return {
      count: raw?.count ?? 0,
      limits: raw?.limits ?? { max_clients_per_user: 0, create_rate_limit_per_hour: 0 },
      clients: Array.isArray(raw?.clients) ? raw!.clients : [],
    };
  },

  async create(payload: PortalClientCreatePayload): Promise<PortalClientCreateResult> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      // `action` siempre explícito (nunca se omite): la ruta del BFF restringe
      // el campo `action` del body a una lista cerrada (bodyEnum) y rechaza
      // con 400 si falta — ver bff/config/routes.bff.yaml, post.portal_my_clients.
      body: { action: 'create', ...payload },
    });
    return raw as unknown as PortalClientCreateResult;
  },

  async rotate(id: number): Promise<PortalClientRotateResult> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { action: 'rotate', id },
    });
    return raw as unknown as PortalClientRotateResult;
  },

  async disable(id: number, reason?: string): Promise<void> {
    await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { action: 'disable', id, ...(reason ? { reason } : {}) },
    });
  },

  async enable(id: number): Promise<void> {
    await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { action: 'enable', id },
    });
  },

  async updateMetadata(id: number, payload: PortalClientUpdateMetadataPayload): Promise<void> {
    await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { action: 'update_metadata', id, ...payload },
    });
  },
};

/** ¿Se alcanzó el tope total de clients (activos + deshabilitados)? Mismo criterio que el backend (`$total >= MAX`). */
export function isClientCapReached(result: Pick<PortalClientListResult, 'count' | 'limits'>): boolean {
  return result.limits.max_clients_per_user > 0 && result.count >= result.limits.max_clients_per_user;
}
