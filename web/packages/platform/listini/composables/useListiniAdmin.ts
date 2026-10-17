import { computed, type ComputedRef } from 'vue';

/**
 * ¿Es el usuario TMWE (anagrafica 1)? Solo TMWE puede cambiar listini base y
 * hacer modificaciones múltiples (igual que el legacy); el backend lo exige,
 * esto solo evita ofrecer acciones que devolverían 403.
 *
 * Lee los bootstrap que inyecta cada aplicación; sin ninguno, asume partner.
 */
interface Globals {
  __TMWE_OPERATIONS__?: { isTmwe?: boolean };
  __TMWE_ANAGRAFICA_CTX__?: { isTmwe?: boolean };
  __TMWE_PARTNER_CLIENTS__?: { isTmwe?: boolean };
}

export function useListiniAdmin(): { isAdmin: ComputedRef<boolean> } {
  const isAdmin = computed(() => {
    if (typeof window === 'undefined') return false;
    const g = window as unknown as Globals;
    return Boolean(
      g.__TMWE_OPERATIONS__?.isTmwe ?? g.__TMWE_ANAGRAFICA_CTX__?.isTmwe ?? g.__TMWE_PARTNER_CLIENTS__?.isTmwe,
    );
  });
  return { isAdmin };
}
