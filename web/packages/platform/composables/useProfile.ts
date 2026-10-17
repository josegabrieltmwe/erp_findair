import { ref, type Ref } from 'vue';

/**
 * Perfil del usuario autenticado, compartido entre todos los consumidores de
 * esta SPA (nav, guards de ruta, etc.) — un solo fetch a `get_my_profile` por
 * carga de página, no uno por componente.
 *
 * A diferencia de `OperationsNav` (que arranca en `isAdmin = true` para no
 * esconderle accesos a un admin mientras carga el perfil — UX, no seguridad),
 * este composable arranca en `null` ("desconocido") y expone `isLoaded` para
 * que un guard de ruta pueda esperar la respuesta real antes de decidir.
 * Fallar cerrado es correcto para un guard; fallar abierto solo es aceptable
 * para ocultar/mostrar un ítem de menú.
 */

/**
 * Cuerpo crudo de `get_my_profile`. Los campos no están todos garantizados
 * (dependen de la versión del backend que respondió), por eso cada
 * consumidor sigue resolviendo sus propios alias (`name` vs `nome`, etc.)
 * en vez de que este composable los normalice por todos.
 */
export interface RawProfile {
  is_admin?: boolean;
  idanagfrc?: number;
  name?: string;
  nome?: string;
  username?: string;
  email?: string;
  mail?: string;
  cliente?: string;
  company?: string;
  partner_logo_url?: string;
  data?: { partner_logo_url?: string };
  [key: string]: unknown;
}

const isAdmin: Ref<boolean | null> = ref(null);
const idAnagrafica: Ref<number | null> = ref(null);
const isLoaded = ref(false);
const profile: Ref<RawProfile | null> = ref(null);
/** `true` si el fetch falló (red o status != ok) — cada consumidor decide su propio fallback (QW5: antes cada uno repetía este mismo fetch y decidía por su cuenta). */
const hasError = ref(false);
let inflight: Promise<void> | null = null;

async function fetchProfile(): Promise<void> {
  try {
    const r = await fetch('/bff/v1/get_my_profile', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) {
      isAdmin.value = false;
      hasError.value = true;
      return;
    }
    const body = (await r.json()) as RawProfile;
    profile.value = body;
    isAdmin.value = body.is_admin === true;
    idAnagrafica.value = typeof body.idanagfrc === 'number' ? body.idanagfrc : null;
  } catch {
    // Error de red: perfil desconocido → un guard debe tratar esto como "no
    // autorizado" (fallar cerrado), no como admin.
    isAdmin.value = false;
    hasError.value = true;
  } finally {
    isLoaded.value = true;
  }
}

export interface UseProfileResult {
  /** `null` mientras no se conoce; `true`/`false` una vez resuelto. */
  isAdmin: Ref<boolean | null>;
  /** `null` mientras no se conoce; id de la anagrafica/partner de la sesión (`idanagfrc`) una vez resuelto. */
  idAnagrafica: Ref<number | null>;
  /** `true` cuando ya se resolvió `get_my_profile` (con éxito o fallback a no-admin). */
  isLoaded: Ref<boolean>;
  /** Cuerpo crudo de la respuesta; `null` mientras no cargó o si falló. */
  profile: Ref<RawProfile | null>;
  /** `true` si el fetch falló — permite a un consumidor con fallback "fail-open" (ej. `OperationsNav`) distinguir eso de un `is_admin: false` legítimo. */
  hasError: Ref<boolean>;
  /** Fuerza a esperar el perfil resuelto — idempotente, reusa el fetch en curso. */
  ensureProfile: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  function ensureProfile(): Promise<void> {
    if (isLoaded.value) return Promise.resolve();
    if (!inflight) inflight = fetchProfile();
    return inflight;
  }

  return { isAdmin, idAnagrafica, isLoaded, profile, hasError, ensureProfile };
}
