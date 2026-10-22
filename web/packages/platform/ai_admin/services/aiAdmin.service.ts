import { http } from '../../anagrafiche/services/http';

/**
 * Administración de IA (contrato `ai-admin/1`, docs/agent-factory/10-contrato-ai-admin.md
 * en tmwe_json). Todas las respuestas llegan como `{success, data}` o
 * `{success:false, error_code, error}`. El contrato nunca devuelve claves ni contenido
 * de memoria o prompts: solo metadatos y recuentos, y este servicio tampoco los pide.
 */

export const AI_FEATURES = ['specialist', 'copilot', 'extract', 'voice', 'wizard', 'cod', 'tracking'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
export const AI_PERIODS = ['day', 'month'] as const;
export type AiPeriod = (typeof AI_PERIODS)[number];
export const AI_USAGE_GROUPS = ['day', 'feature', 'partner', 'model'] as const;
export type AiUsageGroup = (typeof AI_USAGE_GROUPS)[number];
export const AI_SETTING_KEYS = [
  'specialist_enabled',
  'copilot_enabled',
  'voice_enabled',
  'voice_memory_enabled',
] as const;
export type AiSettingKey = (typeof AI_SETTING_KEYS)[number];

export type AiErrorCode =
  | 'AI_FORBIDDEN'
  | 'AI_VALIDATION'
  | 'AI_NOT_FOUND'
  | 'AI_BUDGET_EXCEEDED'
  | 'AI_TIMEOUT'
  | 'AI_UNAVAILABLE';

export class AiAdminError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'AiAdminError';
  }
}

export interface AiSetting {
  key: string;
  value: string;
  scope: 'global' | 'partner';
}

export interface AiBudget {
  id: number;
  partner_id: number | null;
  feature: string;
  period: AiPeriod;
  max_tokens: number | null;
  max_voice_minutes: number | null;
  max_cost_cents: number | null;
}

export interface AiBudgetPayload {
  partner_id?: number | null;
  feature: string;
  period: AiPeriod;
  max_tokens?: number | null;
  max_voice_minutes?: number | null;
  max_cost_cents?: number | null;
}

export interface AiUsageTotals {
  tokens_in: number;
  tokens_out: number;
  voice_seconds: number;
  cost_cents: number | null;
  requests: number;
  errors: number;
}

export interface AiUsageSeriesItem extends AiUsageTotals {
  key: string;
}

export interface AiUsage {
  totals: AiUsageTotals;
  series: AiUsageSeriesItem[];
}

export interface AiUsageFilters {
  from?: string;
  to?: string;
  partner_id?: number | null;
  feature?: string;
  group_by?: AiUsageGroup;
}

export interface AiAuditEntry {
  id: number;
  ts: string;
  partner_id: number | null;
  user_id: number | null;
  actor_client_id: string | null;
  feature: string;
  event: string;
  request_id: string | null;
  tool_names: string | null;
  status: string;
  error_code: string | null;
}

export interface AiAuditFilters {
  partner_id?: number | null;
  feature?: string;
  event?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number | null;
}

export interface Page<T> {
  items: T[];
  next_cursor: number | null;
}

/** Solo metadatos: el contrato no devuelve el contenido de la memoria. */
export interface VoiceMemoryItem {
  id: number;
  user_id: number;
  created_at: string;
  size_chars: number;
}

export interface ElevenlabsHealth {
  profile: string;
  agent_id_set: boolean;
  key_set: boolean;
  last_sync_at: string | null;
  tools_expected: number;
  tools_remote: number | null;
  drift: boolean;
  last_agent_token_at: string | null;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  error_code?: string;
}

function toError(e: unknown): AiAdminError {
  if (e instanceof AiAdminError) return e;
  // ApiError (http.ts) trae el cuerpo del contrato en `details`; el código HTTP
  // 403/429/5xx lo sustituye por FORBIDDEN/RATE_LIMIT/SERVER_ERROR, así que manda `error_code` del cuerpo.
  const err = e as { message?: string; status?: number; statusCode?: number; code?: string; details?: Envelope<unknown> };
  const body = err?.details;
  return new AiAdminError(
    body?.error || err?.message || 'AI admin request failed',
    body?.error_code ?? (typeof err?.code === 'string' ? err.code : null),
    err?.status ?? err?.statusCode ?? 0,
  );
}

async function call<T>(url: string, options?: Record<string, unknown>): Promise<T> {
  let raw: Envelope<T>;
  try {
    raw = await http<Envelope<T>>(url, options);
  } catch (e) {
    throw toError(e);
  }
  if (!raw || raw.success === false || raw.data === undefined) {
    throw new AiAdminError(raw?.error || 'AI admin request failed', raw?.error_code ?? null);
  }
  return raw.data;
}

/** Quita claves vacías para no mandar `partner_id=` ni `feature=` en blanco. */
export function cleanQuery(params: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = String(v);
  }
  return out;
}

const SETTINGS = '/api_admin_ai_settings';
const BUDGETS = '/api_admin_ai_budgets';
const USAGE = '/api_admin_ai_usage';
const AUDIT = '/api_admin_ai_audit';
const MEMORY = '/api_admin_copilot_memory';
const HEALTH = '/api_admin_elevenlabs_health';

export const aiAdminService = {
  async listSettings(partnerId?: number | null): Promise<AiSetting[]> {
    const data = await call<{ items: AiSetting[] }>(SETTINGS, { query: cleanQuery({ partner_id: partnerId }) });
    return Array.isArray(data.items) ? data.items : [];
  },

  async saveSetting(key: string, value: string, partnerId?: number | null): Promise<void> {
    const body: Record<string, unknown> = { key, value };
    if (partnerId != null) body.partner_id = partnerId;
    await call<unknown>(SETTINGS, { method: 'PUT', body });
  },

  async listBudgets(partnerId?: number | null): Promise<AiBudget[]> {
    const data = await call<{ items: AiBudget[] }>(BUDGETS, { query: cleanQuery({ partner_id: partnerId }) });
    return Array.isArray(data.items) ? data.items : [];
  },

  async saveBudget(payload: AiBudgetPayload): Promise<void> {
    await call<unknown>(BUDGETS, { method: 'PUT', body: payload });
  },

  async removeBudget(id: number): Promise<void> {
    await call<unknown>(BUDGETS, { method: 'DELETE', query: { id: String(id) } });
  },

  async getUsage(filters: AiUsageFilters = {}): Promise<AiUsage> {
    const data = await call<AiUsage>(USAGE, { query: cleanQuery(filters) });
    return { totals: data.totals, series: Array.isArray(data.series) ? data.series : [] };
  },

  async listAudit(filters: AiAuditFilters = {}): Promise<Page<AiAuditEntry>> {
    const data = await call<Page<AiAuditEntry>>(AUDIT, { query: cleanQuery(filters) });
    return { items: Array.isArray(data.items) ? data.items : [], next_cursor: data.next_cursor ?? null };
  },

  async listVoiceMemory(cursor?: number | null): Promise<Page<VoiceMemoryItem>> {
    const data = await call<Page<VoiceMemoryItem>>(MEMORY, { query: cleanQuery({ cursor }) });
    return { items: Array.isArray(data.items) ? data.items : [], next_cursor: data.next_cursor ?? null };
  },

  /** Borra TODA la memoria de voz de un usuario. Devuelve cuántas filas se borraron. */
  async eraseVoiceMemoryOfUser(userId: number): Promise<number> {
    const data = await call<{ deleted: number }>(MEMORY, { method: 'DELETE', query: { user_id: String(userId) } });
    return data.deleted ?? 0;
  },

  async eraseVoiceMemoryItem(id: number): Promise<number> {
    const data = await call<{ deleted: number }>(MEMORY, { method: 'DELETE', query: { id: String(id) } });
    return data.deleted ?? 0;
  },

  /** `live` hace que la API consulte a ElevenLabs; sin él solo lee estado local. */
  async getElevenlabsHealth(live = false): Promise<ElevenlabsHealth[]> {
    const data = await call<ElevenlabsHealth[] | { items: ElevenlabsHealth[] }>(HEALTH, {
      query: live ? { live: '1' } : {},
    });
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.items) ? data.items : [];
  },
};
