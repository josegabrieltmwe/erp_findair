import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Shipment } from "@shipment/services/shipment.types";

/**
 * Readonly-by-state logic ported verbatim from spedy_form.php lines 236-332.
 *
 * Conditions:
 *   - $id_fattura_a > 0 && AWB_forn != ''   → 30+ fields locked (fattura emessa)
 *   - $id_fattura_a2 > 0                    → postfatt, post_fuel_surc, postfatt_txt locked
 *   - $id_postfatt > 0 (equivalently we use $id_fattura_a2 > 0 for the same outcome
 *     under the legacy model)                → peso_fornit_reale, costo_reale locked
 *   - $sp_idc !== $idanagfrc                → id_cliente, id_sede readonly when caller
 *                                              isn't the client's owner
 *
 * The composable expects the Shipment object plus the caller's anagrafica_id
 * (we read it from the bootstrap's __TMWE_SHIPMENT__ in real use; tests pass
 * it explicitly).
 *
 * Accepts any ref-like source (Ref, ComputedRef or getter) via MaybeRefOrGetter:
 * call-sites pass `storeToRefs(store).shipment` which is a plain Ref, so a
 * ComputedRef-only signature was too narrow (it only ever reads `.value`).
 */
export function useShipmentState(
  shipment: MaybeRefOrGetter<Shipment | null>,
  callerAnagId?: MaybeRefOrGetter<number | null>,
) {
  const giafatt = computed(() => {
    const s = toValue(shipment);
    if (!s) return false;
    return Number(s.id_fattura_a ?? 0) > 0 && (s.AWB_forn ?? "") !== "";
  });

  const postFatturated = computed(() => {
    const s = toValue(shipment);
    if (!s) return false;
    return Number(s.id_fattura_a2 ?? 0) > 0;
  });

  const fatturaPassivaClosed = computed(() => {
    // Legacy spedy_form.php:326-327 reads `$id_postfatt > 0` to lock
    // peso_fornit_reale + costo_reale. BUT `$id_postfatt` is never
    // populated in the legacy codebase (verified by grep across the
    // whole project) — the branch was dead code. Earlier versions of
    // this composable approximated it as `id_fattura_p > 0`, which
    // wrongly locked those fields on every invoiced-by-supplier
    // shipment. We restore the legacy behaviour (always false) so the
    // two fields stay editable unless `giafatt` takes them over via
    // the broader block-A check.
    return false;
  });

  const clientIsCaller = computed(() => {
    const s = toValue(shipment);
    const caller = toValue(callerAnagId) ?? null;
    if (!s || caller == null) return true; // permissive when caller unknown
    return Number(s.id_anagr_titolare ?? 0) === caller;
  });

  const isCustomsLocked = giafatt;
  const isAmountsLocked = giafatt;
  const isAddressLocked = giafatt;
  const isPackagesLocked = giafatt;

  /** Per-field readonly map. Components consume readonly(field). */
  function readonly(field: string): boolean {
    if (giafatt.value) {
      switch (field) {
        // Block A (always when giafatt): client/sede/RIF, addresses, packages,
        // weight, customs, supplements, fornitore, AWB, dates, amounts.
        case "id_cliente":
        case "id_sede":
        case "RIF_cliente":
        case "rif_cliente":
        case "colli":
        case "peso":
        case "peso_tassato":
        case "opz_par_doc":
        case "dogana_imp":
        case "id_valuta_dogana":
        case "dogana_descri":
        case "contras_imp":
        case "contras_incasso":
        case "contras_data_inc":
        case "assicuraz_imp":
        case "id_valuta_assic":
        case "id_fornitore":
        case "id_servizio_fornitore":
        case "AWB_forn":
        case "data_sped0":
        case "data_sped1":
        case "carico":
        case "fuel_surc":
        case "fuel_surc_cst":
        case "costo":
        case "costo_previsto":
        case "costo_reale":
        case "controllata":
        case "noiva_art9":
          return true;
      }
    }
    if (
      postFatturated.value &&
      (field === "postfatt" ||
        field === "post_fuel_surc" ||
        field === "postfatt_txt")
    ) {
      return true;
    }
    if (
      fatturaPassivaClosed.value &&
      (field === "peso_fornit_reale" || field === "costo_reale")
    ) {
      return true;
    }
    if (
      !clientIsCaller.value &&
      (field === "id_cliente" || field === "id_sede")
    ) {
      return true;
    }
    return false;
  }

  return {
    giafatt,
    postFatturated,
    fatturaPassivaClosed,
    clientIsCaller,
    isCustomsLocked,
    isAmountsLocked,
    isAddressLocked,
    isPackagesLocked,
    readonly,
  };
}
