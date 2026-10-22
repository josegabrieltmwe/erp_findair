import { computed, type ComputedRef } from 'vue';
import { useProfile, type RawProfile } from '../../composables/useProfile';

/**
 * Scopes del contrato ai-admin/1. La API es siempre quien autoriza (devuelve
 * AI_FORBIDDEN); esto solo decide qué pantallas se enseñan en el menú.
 */
export const AI_SCOPES = ['ai:admin', 'ai:audit:read', 'ai:memory:erase', 'ai:generate'] as const;
export type AiScope = (typeof AI_SCOPES)[number];

/** Pestañas del Centro de IA (orden de aparición). */
export const AI_CENTER_TABS = ['usage', 'budgets', 'flags', 'audit', 'memory', 'health', 'mine'] as const;
export type AiCenterTab = (typeof AI_CENTER_TABS)[number];

/**
 * Scope exigido por cada pestaña del Centro de IA (`null` = cualquier usuario
 * autenticado). Única fuente: la lee el propio Centro. «Mi uso» (`mine`) es la
 * vista de Uso en modo propio.
 */
export const AI_TAB_SCOPES = {
  usage: 'ai:admin',
  budgets: 'ai:admin',
  flags: 'ai:admin',
  audit: 'ai:audit:read',
  memory: 'ai:memory:erase',
  health: 'ai:admin',
  mine: null,
} as const satisfies Record<AiCenterTab, AiScope | null>;

/** Rutas antiguas -> pestaña del Centro (se mantienen como redirecciones). */
export const AI_LEGACY_ROUTE_TABS = {
  '/settings/ai-budgets': 'budgets',
  '/settings/ai-flags': 'flags',
  '/settings/ai-audit': 'audit',
  '/settings/voice-memory': 'memory',
  '/settings/my-ai-usage': 'mine',
} as const satisfies Record<string, AiCenterTab>;

/**
 * Lista de scopes del perfil si el backend la expone (`scopes`, array o cadena
 * separada por espacios), o `null` si no la expone.
 */
export function extractScopes(profile: RawProfile | null): string[] | null {
  const raw = profile?.scopes ?? profile?.oauth_scopes;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return null;
}

/**
 * Regla de visibilidad. Con lista de scopes: estricta (`ai:admin` implica los
 * demás de administración, no `ai:generate`). Sin lista: se confía en el perfil
 * (solo un admin ve las pantallas de administración) y la API remata con 403.
 */
export function canSeeAiScope(
  profile: RawProfile | null,
  isAdmin: boolean | null,
  scope: AiScope | null,
): boolean {
  if (scope === null) return true;
  const scopes = extractScopes(profile);
  if (scopes) {
    if (scopes.includes(scope)) return true;
    return scope !== 'ai:generate' && scopes.includes('ai:admin');
  }
  return isAdmin === true;
}

export function useAiScopes() {
  const { profile, isAdmin, ensureProfile } = useProfile();
  const can = (scope: AiScope | null): ComputedRef<boolean> =>
    computed(() => canSeeAiScope(profile.value, isAdmin.value, scope));
  return { ensureProfile, can, profile, isAdmin };
}

/** Pestañas visibles para el perfil, en orden. */
export function visibleAiTabs(profile: RawProfile | null, isAdmin: boolean | null): AiCenterTab[] {
  return AI_CENTER_TABS.filter((t) => canSeeAiScope(profile, isAdmin, AI_TAB_SCOPES[t]));
}

/** Pestaña pedida si es visible; si no, la primera visible (`null` si no hay). */
export function resolveAiTab(requested: unknown, visible: readonly AiCenterTab[]): AiCenterTab | null {
  const r = Array.isArray(requested) ? requested[0] : requested;
  return visible.find((t) => t === r) ?? visible[0] ?? null;
}
