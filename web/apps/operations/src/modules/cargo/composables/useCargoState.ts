import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Cargo } from "@cargo/services/cargo.types";

/**
 * Readonly-by-state logic ported from spedyc_form.php:376-400.
 *
 * Cargo's locking condition is similar to express but slightly different:
 *   - giafatt:  id_fattura_a > 0 && AWB_forn != '' && consegna_data != '0000-00-00'
 *     (cargo requires the delivery date as well — invoices can be issued before
 *     the cargo flies, in which case only AWB-dependent fields lock.)
 *   - postFatturated: id_fattura_a2 > 0
 *   - supplierInvoiced: id_fattura_p > 0 (real cost locks)
 */
export function useCargoState(cargo: MaybeRefOrGetter<Cargo | null>) {
  const giafatt = computed(() => {
    const s = toValue(cargo);
    if (!s) return false;
    const invoiceIssued = Number(s.id_fattura_a ?? 0) > 0;
    const awbAssigned = (s.AWB_forn ?? "") !== "";
    const delivered =
      (s.consegna_data ?? "") !== "" &&
      s.consegna_data !== "0000-00-00 00:00:00";
    return invoiceIssued && awbAssigned && delivered;
  });

  const postFatturated = computed(() => {
    const s = toValue(cargo);
    if (!s) return false;
    return Number(s.id_fattura_a2 ?? 0) > 0;
  });

  const supplierInvoiced = computed(() => {
    const s = toValue(cargo);
    if (!s) return false;
    return Number(s.id_fattura_p ?? 0) > 0;
  });

  const isAddressLocked = giafatt;
  const isPackagesLocked = giafatt;
  const isCustomsLocked = giafatt;

  function readonly(field: string): boolean {
    if (giafatt.value) {
      switch (field) {
        case "id_cliente":
        case "id_sede":
        case "RIF_cliente":
        case "rif_cliente":
        case "colli":
        case "peso":
        case "pesor":
        case "dogana_imp":
        case "id_valuta_dogana":
        case "dogana_descri":
        case "assicuraz_imp":
        case "id_valuta_assic":
        case "terminal_part":
        case "terminal_dest":
        case "AWB_forn":
        case "vettore_sigla":
        case "vettore_id":
        case "data_sped0":
        case "data_sped1":
        case "carico_export":
        case "carico_import":
        case "carico_volo":
        case "noiva_art9":
          return true;
      }
    }
    if (
      postFatturated.value &&
      (field === "carico_extra" || field === "postfatt_txt")
    ) {
      return true;
    }
    if (
      supplierInvoiced.value &&
      (field === "costo_volo_reale" || field === "peso_fornit_reale")
    ) {
      return true;
    }
    return false;
  }

  return {
    giafatt,
    postFatturated,
    supplierInvoiced,
    isAddressLocked,
    isPackagesLocked,
    isCustomsLocked,
    readonly,
  };
}
