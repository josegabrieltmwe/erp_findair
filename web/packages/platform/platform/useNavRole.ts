import { ref, type Ref } from "vue";
import { useProfile } from "../composables/useProfile";

/**
 * Rol del usuario para el menú y la home (`is_admin` = anagrafica TMWE, id 1).
 *
 * Reusa el fetch compartido de `get_my_profile` (`useProfile`): una sola
 * petición por carga de la SPA para el menú, la home y el resto.
 *
 * Default true (admin) para que un admin NUNCA pierda accesos mientras carga el
 * perfil; un partner ve Admin/tools un instante y desaparecen al llegar el
 * perfil — preferible a esconderle a un admin sus enlaces. `useProfile` falla
 * CERRADO (`isAdmin=false` en error, para guards); esta nav falla ABIERTO a
 * propósito, así que solo adopta el valor resuelto cuando el fetch compartido
 * no tuvo error — un error deja el default `true` intacto.
 */
const isAdmin = ref<boolean>(true);

export async function loadNavRole(): Promise<void> {
  const { profile, hasError, ensureProfile } = useProfile();
  await ensureProfile();
  if (hasError.value) return;
  isAdmin.value = profile.value?.is_admin === true;
}

export function useNavRole(): { isAdmin: Ref<boolean>; load: () => Promise<void> } {
  return { isAdmin, load: loadNavRole };
}
