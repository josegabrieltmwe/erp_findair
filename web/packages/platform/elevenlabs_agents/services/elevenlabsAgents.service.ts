import type { FetchOptions } from 'ofetch';
import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Agentes de voz PROPIOS de partner (ElevenLabs), docs/02-arquitectura/agentes-ia/09-seguridad-agentes-propios-de-partner.md.
 *
 *  - partnerAgentsService: autoservicio del partner sobre SUS filas
 *    (/api_partner_elevenlabs_agents). El partner nunca envia su id: el
 *    servidor lo toma de la sesion. Las claves (api_key, webhook_secret) son de
 *    solo escritura: se envian y no vuelven nunca.
 *  - agentReviewService: revision/aprobacion por un administrador de TMWE
 *    (/api_admin_elevenlabs_review).
 */

export const AGENT_PROFILES = ['public_form', 'copilot_operator'] as const;
export type AgentProfile = (typeof AGENT_PROFILES)[number];

export const APPROVAL_STATUSES = ['draft', 'pending_review', 'approved', 'rejected', 'suspended'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface AuditFinding {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  area: string;
  message: string;
  blocking: boolean;
  heuristic?: boolean;
}

export interface InspectReport {
  agent_name: string;
  blocking: number;
  summary: Record<string, number>;
  findings: AuditFinding[];
  version_id: string | null;
  can_be_approved: boolean;
}

export interface AgentEvent {
  event: string;
  status_before: string | null;
  status_after: string | null;
  actor_anagrafica: number | null;
  created_at: string | null;
  details: Record<string, unknown> | null;
}

export interface AgentRow {
  id: number;
  partner_id: number | null;
  partner_name?: string | null;
  profile: AgentProfile | string;
  agent_id: string | null;
  tts_voice_id: string | null;
  description: string | null;
  approval_status: ApprovalStatus | null;
  billing_owner: 'partner' | 'tmwe' | null;
  requested_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  suspended_reason: string | null;
  approved_version_id: string | null;
  last_verified_at: string | null;
  has_key: boolean;
  has_webhook_secret: boolean;
  last_audit: { blocking: number | null; summary: Record<string, number> | null } | null;
  events?: AgentEvent[];
}

export interface AgentPayload {
  profile?: string;
  agent_id?: string;
  /** Solo escritura. Vacio en una edicion = sin cambios. */
  api_key?: string;
  /** Solo escritura. Vacio en una edicion = sin cambios. */
  webhook_secret?: string;
  tts_voice_id?: string;
  description?: string;
}

/** Error de la API de agentes: `code` es el codigo del servidor; `report` trae el informe si lo hay. */
export class AgentApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly report: InspectReport | null = null,
    public readonly fields: Record<string, string> | null = null,
  ) {
    super(message);
    this.name = 'AgentApiError';
  }
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

/** Convierte cualquier fallo (ApiError, red) en un AgentApiError con el codigo del servidor. */
export function toAgentError(e: unknown): AgentApiError {
  if (e instanceof AgentApiError) return e;
  if (e instanceof ApiError) {
    const body = (e.details ?? {}) as Envelope<unknown>;
    const code = typeof body.error === 'string' ? body.error : e.message || 'error';
    const details = body.details as Record<string, unknown> | null | undefined;
    const report = details && Array.isArray((details as { findings?: unknown }).findings) ? (details as unknown as InspectReport) : null;
    const fields = details && !report && typeof details === 'object' ? (details as Record<string, string>) : null;
    return new AgentApiError(code, code, e.status, report, fields);
  }
  const message = e instanceof Error ? e.message : String(e);
  return new AgentApiError(message, 'network_error', 0);
}

async function call<T>(url: string, options: FetchOptions<'json'> = {}): Promise<T> {
  try {
    const raw = (await http<Envelope<T>>(url, options)) as Envelope<T>;
    if (raw?.success === false) {
      throw new AgentApiError(raw.error || 'error', raw.error || 'error', 0);
    }
    return raw?.data as T;
  } catch (e) {
    throw toAgentError(e);
  }
}

const PARTNER_ENDPOINT = '/api_partner_elevenlabs_agents';
const REVIEW_ENDPOINT = '/api_admin_elevenlabs_review';

export const partnerAgentsService = {
  async list(): Promise<{ agents: AgentRow[]; profiles: string[] }> {
    return call(PARTNER_ENDPOINT);
  },
  async get(id: number): Promise<AgentRow> {
    return call(PARTNER_ENDPOINT, { query: { id: String(id) } });
  },
  async create(payload: AgentPayload): Promise<AgentRow> {
    return call(PARTNER_ENDPOINT, { method: 'POST', body: { op: 'create', ...payload } });
  },
  async update(id: number, payload: AgentPayload): Promise<AgentRow> {
    return call(PARTNER_ENDPOINT, { method: 'PUT', body: { id, ...payload } });
  },
  async remove(id: number): Promise<void> {
    await call(PARTNER_ENDPOINT, { method: 'DELETE', query: { id: String(id) } });
  },
  /** Inspecciona el agente en ElevenLabs (solo lectura); no cambia ningun estado. */
  async validate(id: number): Promise<InspectReport> {
    return call(PARTNER_ENDPOINT, { method: 'POST', body: { op: 'validate', id } });
  },
  async requestReview(id: number): Promise<AgentRow> {
    return call(PARTNER_ENDPOINT, { method: 'POST', body: { op: 'request_review', id } });
  },
};

export const agentReviewService = {
  async list(status: ApprovalStatus): Promise<AgentRow[]> {
    const r = await call<{ status: string; agents: AgentRow[] }>(REVIEW_ENDPOINT, { query: { status } });
    return r.agents;
  },
  async get(id: number): Promise<AgentRow & { last_audit_report?: unknown }> {
    return call(REVIEW_ENDPOINT, { query: { id: String(id) } });
  },
  async inspect(id: number): Promise<InspectReport> {
    return call(REVIEW_ENDPOINT, { method: 'POST', body: { op: 'inspect', id } });
  },
  async approve(id: number, notes = ''): Promise<AgentRow> {
    return call(REVIEW_ENDPOINT, { method: 'POST', body: { op: 'approve', id, notes } });
  },
  async reject(id: number, notes: string): Promise<AgentRow> {
    return call(REVIEW_ENDPOINT, { method: 'POST', body: { op: 'reject', id, notes } });
  },
  async suspend(id: number, notes: string): Promise<AgentRow> {
    return call(REVIEW_ENDPOINT, { method: 'POST', body: { op: 'suspend', id, notes } });
  },
  async reactivate(id: number, notes = ''): Promise<AgentRow> {
    return call(REVIEW_ENDPOINT, { method: 'POST', body: { op: 'reactivate', id, notes } });
  },
};

/** Color de Vuetify para el estado de aprobacion. */
export function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending_review':
      return 'info';
    case 'rejected':
    case 'suspended':
      return 'error';
    default:
      return 'default';
  }
}

/** Color para la gravedad de un hallazgo. */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
}

/** Solo estos estados admiten solicitar revision (el servidor lo vuelve a comprobar). */
export function canRequestReview(status: string | null | undefined): boolean {
  return status === 'draft' || status === 'rejected' || status === 'suspended';
}
