import { computed, type ComputedRef } from 'vue';

/**
 * useAnagraficaContext
 *
 * Shared role/context for the anagrafica form, consumed by BOTH host apps:
 *  - partner_clients (a partner managing its own clients from the ERP UI)
 *  - admin_config    (a TMWE operator managing any partner's clients)
 *
 * `isTmwe` decides role-gated behaviour that legacy enforces in anagr_form.php:
 *  - only TMWE may edit `tipo` and `id_anagr_titolare` (anagr_form.php:68,190);
 *  - when a TMWE operator edits a partner's client, the commercial selects
 *    (payment methods/schedules/agents) must be scoped to that client's
 *    `id_anagr_titolare`, not to TMWE — see paymentsService + the backend's
 *    Abstract_Pagamenti_Controller::resolve_target_partner_id().
 *
 * Source of `isTmwe` (in priority order):
 *  1. window.__TMWE_ANAGRAFICA_CTX__.isTmwe — explicit override an app can set
 *     (admin_config mirrors its permissions.store here in main.ts).
 *  2. window.__TMWE_PARTNER_CLIENTS__.isTmwe — partner_clients bootstrap payload.
 * Defaults to false (partner) when nothing is present — the safe, least-
 * privileged assumption; the backend enforces real isolation regardless.
 */

/**
 * Shape of the two window globals this composable reads. Declared locally (not
 * as `declare global`) so the package stays self-contained and doesn't clash
 * with each host app's own env.d.ts declarations.
 */
interface TmweGlobals {
  __TMWE_ANAGRAFICA_CTX__?: { isTmwe?: boolean };
  __TMWE_PARTNER_CLIENTS__?: { isTmwe?: boolean };
}

function readIsTmwe(): boolean {
  if (typeof window === 'undefined') return false;
  const g = window as unknown as TmweGlobals;
  if (typeof g.__TMWE_ANAGRAFICA_CTX__?.isTmwe === 'boolean') {
    return g.__TMWE_ANAGRAFICA_CTX__.isTmwe;
  }
  if (typeof g.__TMWE_PARTNER_CLIENTS__?.isTmwe === 'boolean') {
    return g.__TMWE_PARTNER_CLIENTS__.isTmwe;
  }
  return false;
}

export interface UseAnagraficaContextResult {
  /** True when the current user is the TMWE operator (anagrafica id=1). */
  isTmwe: ComputedRef<boolean>;
  /**
   * Resolve the partner whose commercial config should populate the selects,
   * given the client being edited. For TMWE that's the client's titolare; for
   * a partner it's irrelevant (backend uses the session) so we return undefined
   * and let the service omit the param.
   */
  scopeTitolare: (clientTitolareId?: number | null) => number | undefined;
}

export function useAnagraficaContext(): UseAnagraficaContextResult {
  const isTmwe = computed(readIsTmwe);

  function scopeTitolare(clientTitolareId?: number | null): number | undefined {
    if (!isTmwe.value) return undefined;
    const id = Number(clientTitolareId ?? 0);
    return id > 0 ? id : undefined;
  }

  return { isTmwe, scopeTitolare };
}
