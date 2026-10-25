import { computed, type ComputedRef } from 'vue';
import { useProfile, type RawProfile } from './useProfile';

/**
 * Permisos de la persona para decidir QUÉ MOSTRAR (menús, tarjetas, rutas), sin deducirlo de `is_admin`.
 *
 * Se alimenta de `get_my_profile.access`: roles de la persona y scopes efectivos del token (rol de la app ∩
 * roles de la persona). Es solo UX: la API autoriza cada petición, así que un fallo aquí nunca concede nada.
 *
 * Mientras el perfil no se conoce, o si el backend no trae `access`, todo es `false` (falla cerrado): un guard
 * de ruta debe esperar `ensureProfile()` antes de preguntar.
 */
export interface AccessSnapshot {
  roles: string[];
  scopes: string[];
  isRoot: boolean;
  /** `true` si el backend informó `access` (distingue "sin permisos" de "backend antiguo"). */
  known: boolean;
}

const EMPTY: AccessSnapshot = { roles: [], scopes: [], isRoot: false, known: false };

/** Lógica pura: del cuerpo de `get_my_profile` al snapshot. */
export function buildAccess(profile: RawProfile | null | undefined): AccessSnapshot {
  const access = profile?.access;
  if (!access || typeof access !== 'object') return EMPTY;
  const roles = (Array.isArray(access.roles) ? access.roles : [])
    .map((r) => (r && typeof r.name === 'string' ? r.name : ''))
    .filter(Boolean);
  const scopes = (Array.isArray(access.scopes) ? access.scopes : []).filter(
    (s): s is string => typeof s === 'string' && s !== '',
  );
  return { roles, scopes, isRoot: access.is_root === true, known: true };
}

/** `required` puede ser un scope o una lista; con lista basta uno (`any`) o hacen falta todos (`all`). */
export function hasScope(
  snapshot: AccessSnapshot,
  required: string | readonly string[],
  mode: 'any' | 'all' = 'any',
): boolean {
  const list = typeof required === 'string' ? [required] : required;
  if (list.length === 0) return false;
  const owned = new Set(snapshot.scopes);
  return mode === 'all' ? list.every((s) => owned.has(s)) : list.some((s) => owned.has(s));
}

export interface UseAccessResult {
  access: ComputedRef<AccessSnapshot>;
  /** ¿Tiene el scope (o alguno de la lista)? */
  can: (required: string | readonly string[], mode?: 'any' | 'all') => boolean;
  hasRole: (name: string) => boolean;
  isRoot: ComputedRef<boolean>;
  ensureProfile: () => Promise<void>;
}

export function useAccess(): UseAccessResult {
  const { profile, ensureProfile } = useProfile();
  const access = computed(() => buildAccess(profile.value));
  return {
    access,
    can: (required, mode = 'any') => hasScope(access.value, required, mode),
    hasRole: (name) => access.value.roles.includes(name),
    isRoot: computed(() => access.value.isRoot),
    ensureProfile,
  };
}
