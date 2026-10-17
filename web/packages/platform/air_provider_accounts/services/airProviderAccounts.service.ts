import { http } from '../../anagrafiche/services/http';

/**
 * Inventario AGREGADO de cuentas de proveedor aéreo — Fase A-bis del plan
 * de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md), Incremento 3 de
 * `docs/proposal-admin-air-cargo-credentials.md`.
 *
 * Solo lectura: el endpoint devuelve 405 a cualquier escritura salvo
 * `operation=resolve_preview` (simulación, no muta nada). Las
 * modificaciones siguen haciéndose en las pantallas por tabla (KLM,
 * WebCargo, fornitori_accnt) hasta que lleguen los comandos explícitos del
 * Incremento 5.
 *
 * Ningún tipo de este fichero incluye un secreto: el backend proyecta
 * `has_secret` y nunca serializa key/URN/token. Portado 1:1 desde
 * `admin_config/src/services/airProviderAccounts.service.ts`.
 */

/** Proveedor de autenticación. `afkl` cubre KL y AF con una sola cuenta. */
export type AirProvider = 'afkl' | 'webcargo';

export type AirEnvironment = 'sandbox' | 'production';

/**
 * Estado canónico. `not_verified` es el valor honesto por defecto: que
 * exista un secreto NO prueba que autentique, que tenga el producto
 * contratado ni que cubra la ruta. Solo la prueba de conexión (Incremento
 * 6) puede decir `healthy`.
 */
export type AirAccountHealth =
  | 'not_verified'
  | 'incomplete'
  | 'environment_managed'
  | 'healthy'
  | 'failed'
  | 'expired';

/** Fila física que respalda una capacidad. No es una FK de la UI. */
export interface AirSourceRef {
  source: string;
  id: number;
}

export interface AirCapability {
  /** sales | tracking | opendata | published | realtime */
  code: string;
  configured: boolean;
  /** Proyección segura: nunca el secreto en sí. */
  has_secret: boolean;
  active?: boolean;
  /** Varias filas pueden respaldar la MISMA capacidad (una key por mercado). */
  source_refs: AirSourceRef[];
}

export interface AirCoverage {
  country_iso: string;
  terminals: string[];
  airlines: string[];
  primary: boolean;
}

/** Party AV/DQ: identificadores, no secretos. Solo WebCargo realtime. */
export interface AirRepresentation {
  country_iso: string;
  av: string;
  dq: string;
  av_country: string;
  active: boolean;
}

export interface AirAccountWarning {
  code: string;
  detail: string;
}

export interface AirProviderAccount {
  /** Clave de UI OPACA (`afkl:9069:production`): no es FK ni se persiste. */
  account_key: string;
  provider: AirProvider;
  provider_label: string;
  owner: { partner_id: number; name: string };
  environment: AirEnvironment;
  relationship: string;
  capabilities: AirCapability[];
  coverage: AirCoverage[];
  representations: AirRepresentation[];
  health: {
    status: AirAccountHealth;
    warnings: AirAccountWarning[];
    last_verified_at: string | null;
  };
}

export interface AirAccountFilters {
  owner_partner_id?: number;
  provider?: AirProvider;
  environment?: AirEnvironment;
  country_iso?: string;
  include_inactive?: boolean;
}

/** Candidata que el resolutor descartó, con el motivo. */
export interface AirPreviewDiscarded {
  partner_id: number;
  partner_name: string | null;
  ref_id: number;
  reasons: string[];
  why_not: string;
}

export interface AirResolvePreviewRequest {
  provider: AirProvider;
  capability: string;
  requesting_partner_id: number;
  origin?: string;
  destination?: string;
  environment?: AirEnvironment;
}

export interface AirResolvePreview {
  resolved: boolean;
  error?: string;
  provider?: AirProvider;
  capability?: string;
  route?: {
    origin: string;
    destination: string;
    origin_country: string;
    destination_country: string;
  };
  account_key?: string;
  owner_partner_id?: number;
  owner_name?: string | null;
  relationship?: string;
  /** Códigos estables (`titolare`, `origin`…). Se traducen en el front. */
  reason_codes?: string[];
  /** Solo fuente e id: nunca key, URN ni token. */
  credential_ref?: AirSourceRef;
  warnings: AirAccountWarning[];
  discarded?: AirPreviewDiscarded[];
}

interface RawListResponse {
  success?: boolean;
  error?: string;
  data?: {
    accounts?: AirProviderAccount[];
    count?: number;
  };
}

interface RawDetailResponse {
  success?: boolean;
  error?: string;
  data?: { account?: AirProviderAccount };
}

interface RawPreviewResponse {
  success?: boolean;
  error?: string;
  data?: AirResolvePreview;
}

const ENDPOINT = '/api_admin_air_provider_accounts';

export const airProviderAccountsService = {
  async list(filters: AirAccountFilters = {}): Promise<AirProviderAccount[]> {
    const query: Record<string, string> = {};
    if (filters.owner_partner_id) query.owner_partner_id = String(filters.owner_partner_id);
    if (filters.provider) query.provider = filters.provider;
    if (filters.environment) query.environment = filters.environment;
    if (filters.country_iso) query.country_iso = filters.country_iso;
    if (filters.include_inactive) query.include_inactive = '1';

    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load air provider accounts');
    return raw?.data?.accounts ?? [];
  },

  async detail(accountKey: string): Promise<AirProviderAccount | null> {
    const raw = await http<RawDetailResponse>(ENDPOINT, { query: { account_key: accountKey } });
    if (raw?.success === false) throw new Error(raw.error || 'Account not found');
    return raw?.data?.account ?? null;
  },

  /**
   * Qué cuenta elegiría una búsqueda real, y por qué.
   *
   * Va por POST porque lleva cuerpo, pero es una CONSULTA: no modifica
   * nada ni llama al carrier. El backend solo admite
   * `operation: resolve_preview` y rechaza el resto con 405.
   */
  async resolvePreview(req: AirResolvePreviewRequest): Promise<AirResolvePreview> {
    const raw = await http<RawPreviewResponse>(ENDPOINT, {
      method: 'POST',
      body: { operation: 'resolve_preview', ...req },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Preview failed');
    return raw?.data ?? { resolved: false, warnings: [] };
  },
};
