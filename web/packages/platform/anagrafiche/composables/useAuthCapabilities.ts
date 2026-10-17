import { computed, type ComputedRef } from 'vue';
import authCapabilitiesData from '../data/auth_capabilities.json';

/**
 * Plan v5 F1: useAuthCapabilities
 *
 * Carga el catálogo formal de flags contatti.auth_* generado por
 * bin/generate_auth_constants.php desde config/auth_capabilities.yml.
 *
 * Estructura source of truth: ver config/auth_capabilities.yml
 * Reference humano: ver docs/api/auth_capabilities_reference.md
 *
 * Uso:
 *   const { capabilities, getByFlag, activeFlags, byType } = useAuthCapabilities();
 *
 * El JSON se importa estáticamente (incluido en bundle), no se fetchea.
 * Cada commit del YAML requiere re-generar + rebuild del SPA.
 */

export type AuthCapType = 'capability' | 'filter' | 'reserved';

export interface AuthCapability {
  type: AuthCapType;
  display_name: string;
  description: string;
  semantic: string;
  audience: string[];
  introduces: string[];   // module:operation tuples granted by this flag
  bypasses: string[];     // other flag ids whose filter this flag overrides
  bypassed_by: string[];  // flag ids that override this filter
  notes?: string;
  deprecated?: boolean;
  filter_sql?: string;    // present on type=filter
}

interface RawData {
  _generated_at?: string;
  capabilities: Record<string, AuthCapability>;
}

const data = authCapabilitiesData as unknown as RawData;

export interface UseAuthCapabilitiesResult {
  /** All flags indexed by id (auth_10..auth_24). */
  capabilities: ComputedRef<Record<string, AuthCapability>>;
  /** All flag ids in declaration order (auth_10 first, auth_24 last). */
  allFlags: ComputedRef<string[]>;
  /** Flag ids that are NOT type='reserved'. */
  activeFlags: ComputedRef<string[]>;
  /** Flag ids by type bucket. */
  byType: ComputedRef<Record<AuthCapType, string[]>>;
  /** Lookup by flag id. */
  getByFlag: (flag: string) => AuthCapability | null;
  /** Generation timestamp from the YAML. */
  generatedAt: ComputedRef<string | null>;
}

export function useAuthCapabilities(): UseAuthCapabilitiesResult {
  const caps = data.capabilities ?? {};

  const capabilities = computed(() => caps);
  const allFlags = computed(() => Object.keys(caps));
  const activeFlags = computed(() =>
    allFlags.value.filter((f) => caps[f]?.type !== 'reserved'),
  );
  const byType = computed<Record<AuthCapType, string[]>>(() => {
    const buckets: Record<AuthCapType, string[]> = {
      capability: [],
      filter: [],
      reserved: [],
    };
    for (const f of allFlags.value) {
      const t = caps[f]?.type;
      if (t && t in buckets) {
        buckets[t].push(f);
      }
    }
    return buckets;
  });
  const generatedAt = computed(() => data._generated_at ?? null);

  function getByFlag(flag: string): AuthCapability | null {
    return caps[flag] ?? null;
  }

  return {
    capabilities,
    allFlags,
    activeFlags,
    byType,
    getByFlag,
    generatedAt,
  };
}
