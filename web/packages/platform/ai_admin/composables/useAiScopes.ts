import { computed, type ComputedRef } from 'vue';
import { useProfile, type RawProfile } from '../../composables/useProfile';

/**
 * Scopes del contrato ai-admin/1. La API es siempre quien autoriza (devuelve
 * AI_FORBIDDEN); esto solo decide qué pantallas se enseñan en el menú.
 */
export const AI_SCOPES = ['ai:admin', 'ai:audit:read', 'ai:memory:erase', 'ai:generate'] as const;
export type AiScope = (typeof AI_SCOPES)[number];

/**
 * Scope exigido por cada pantalla (`null` = cualquier usuario autenticado).
 * Única fuente: la leen el router (`meta.aiScope`) y el catálogo de Settings.
 */
export const AI_ROUTE_SCOPES = {
  'settings-ai-center': 'ai:admin',
  'settings-ai-budgets': 'ai:admin',
  'settings-ai-flags': 'ai:admin',
  'settings-voice-memory': 'ai:memory:erase',
  'settings-ai-audit': 'ai:audit:read',
  'settings-my-ai-usage': null,
} as const satisfies Record<string, AiScope | null>;

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
