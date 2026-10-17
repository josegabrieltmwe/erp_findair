import { ref, watch, type Ref } from "vue";
import { sedeIsoService } from "@shipment/services/sede_iso.service";
import type { Shipment } from "@shipment/services/shipment.types";

/**
 * Decides whether the customs-document option block (`opz_par_doc`) should be
 * shown, porting the legacy spedy_form.php `Opz_par_doc()` rule:
 *
 *   x1 = origin country (part_id_paese_iso)
 *   x2 = destination country (dest_id_paese_iso); when empty it falls back to
 *        the pickup site's country (sed_id_paese_iso) — exactly the legacy
 *        `sede_isopaese` fallback that spedy_isopresa.php fed.
 *   show  = origin OR effective-destination is NON-EU
 *   hide  = same country on both ends
 *
 * EU membership comes from the backend (paesi_iso.CEE via api_sede_iso) so we
 * keep a single source of truth instead of hardcoding the country list.
 */
export interface CustomsDocVisibility {
  /** True when the opz_par_doc block must be shown. */
  visible: Ref<boolean>;
  /** True when opz_par_doc is mandatory (non-EU route) and must be filled. */
  required: Ref<boolean>;
}

export function useCustomsDocVisibility(
  shipment: Ref<Shipment | null>,
): CustomsDocVisibility {
  const visible = ref(true);
  const required = ref(false);

  async function recompute(): Promise<void> {
    const s = shipment.value;
    if (!s) {
      visible.value = true;
      required.value = false;
      return;
    }
    const x1 = (s.part_id_paese_iso || "").toUpperCase().trim();
    const x2raw = (s.dest_id_paese_iso || "").toUpperCase().trim();
    const sede = (s.sed_id_paese_iso || "").toUpperCase().trim();
    const x2 = x2raw !== "" ? x2raw : sede; // legacy fallback dest → sede

    // Same country on both ends → no customs doc block.
    if (x1 !== "" && x2 !== "" && x1 === x2) {
      visible.value = false;
      required.value = false;
      return;
    }

    const [x1cee, x2cee] = await Promise.all([
      x1 !== "" ? sedeIsoService.isCee(x1) : Promise.resolve(false),
      x2 !== "" ? sedeIsoService.isCee(x2) : Promise.resolve(false),
    ]);

    // Shown when origin OR effective destination is non-EU.
    const nonEu = !x1cee || !x2cee;
    visible.value = nonEu;
    required.value = nonEu;
  }

  watch(
    () => {
      const s = shipment.value;
      return [
        s?.part_id_paese_iso,
        s?.dest_id_paese_iso,
        s?.sed_id_paese_iso,
      ].join("|");
    },
    () => {
      void recompute();
    },
    { immediate: true },
  );

  return { visible, required };
}
