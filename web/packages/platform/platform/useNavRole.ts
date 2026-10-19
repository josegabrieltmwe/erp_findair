import { ref, type Ref } from "vue";
import { useProfile } from "../composables/useProfile";

/**
 * Rol del usuario para el menú y la home (`is_admin` = anagrafica TMWE, id 1).
 *
 * Reusa el fetch compartido de `get_my_profile` (`useProfile`): una sola
 * petición por carga de la SPA para el menú, la home y el resto.
 *
 * Falla CERRADO: default false (sin resolver = partner) y un error de perfil lo
 * deja en false. Un partner nunca ve Admin/tools mientras carga el perfil; el
 * admin ve un instante el menú reducido hasta que llega `is_admin`. Coherente con
 * `useProfile`, que también falla cerrado.
 */
const isAdmin = ref<boolean>(false);

export async function loadNavRole(): Promise<void> {
  const { profile, hasError, ensureProfile } = useProfile();
  await ensureProfile();
  if (hasError.value) return;
  isAdmin.value = profile.value?.is_admin === true;
}

export function useNavRole(): { isAdmin: Ref<boolean>; load: () => Promise<void> } {
  return { isAdmin, load: loadNavRole };
}
