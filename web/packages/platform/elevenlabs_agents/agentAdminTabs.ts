/** Pestañas del panel de administración de agentes de voz (rol admin TMWE). */
export const AGENT_ADMIN_TABS = ['sync', 'review'] as const;
export type AgentAdminTab = (typeof AGENT_ADMIN_TABS)[number];

export function resolveAgentAdminTab(requested: unknown): AgentAdminTab {
  const r = Array.isArray(requested) ? requested[0] : requested;
  return AGENT_ADMIN_TABS.find((t) => t === r) ?? 'sync';
}
