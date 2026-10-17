import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  masterSupplementsService,
  type MasterSupplement,
} from "@shipment/services/master_supplements.service";
import { useToastStore } from "./toast.store";

/**
 * Catálogo maestro de suplementos para el picker dialog.
 *
 * Carga el listado una vez por sesión (la lista cambia muy raramente)
 * y lo expone agrupado por `gruppo` 1-5 para que el dialog pueda
 * renderizar subheaders. La invalidación es manual: si un admin
 * acaba de cambiar el catálogo, refresca la página.
 */
export const useSupplementsStore = defineStore("supplements_catalog", () => {
  const catalog = ref<MasterSupplement[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  /**
   * Agrupado por `gruppo` (1-5). Los items sin grupo caen en bucket '0'.
   * Cada grupo viene ordenado por `orderby` ascendente y `nome` como
   * tiebreaker.
   */
  const byGroup = computed<Record<string, MasterSupplement[]>>(() => {
    const out: Record<string, MasterSupplement[]> = {};
    for (const s of catalog.value) {
      const g = String(s.gruppo ?? "0");
      if (!out[g]) out[g] = [];
      out[g].push(s);
    }
    for (const g in out) {
      out[g].sort((a, b) => {
        const ao = Number(a.orderby ?? 0);
        const bo = Number(b.orderby ?? 0);
        if (ao !== bo) return ao - bo;
        return (a.nome ?? "").localeCompare(b.nome ?? "");
      });
    }
    return out;
  });

  /**
   * Plain list of supplements visible to the picker dialog. The
   * server-side filter (see ensureLoaded) already restricts the
   * catalog to picker-manual / express items, so this computed is now
   * an identity view kept for backwards compatibility with consumers.
   */
  const expressVisible = computed<MasterSupplement[]>(() => catalog.value);

  /**
   * Load the catalog filtered server-side to mirror legacy
   * `spedy_dev_array.php` semantics:
   *
   *   SELECT ... FROM supplementi
   *   WHERE stato='A'
   *     AND sped_ckbox='S'
   *     AND autosize='N'   -- auto-sized supplements (computed from peso/dim)
   *     AND fisso='N'      -- fixed supplements applied by service config
   *     AND id NOT IN (1,2,3,4,5,13,15,25,97-100,115-118,120-123)
   *                       -- $sppaut blacklist (profilo.php:71-72)
   *
   * The blacklist lives on the server (Supplementi_Model::AUTO_APPLIED_IDS);
   * the `picker_manual='S'` flag asks the backend to apply it. Without
   * these filters the picker dialog used to show every catalog row,
   * including items the legacy form intentionally hides from manual
   * selection. Sending the filters to the API closes the parity gap.
   */
  async function ensureLoaded(force = false): Promise<void> {
    if (loaded.value && !force) return;
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      // Mirror legacy spedy_dev_array.php verbatim: legacy does NOT
      // filter by `courier` or `cargo` — it returns every supplement
      // matching the four flags below, then groups them by `gruppo`.
      // Adding a `courier='S'` filter (a previous misguided attempt)
      // dropped ~half of the picker entries (Dry Ice, DGR variants,
      // Lithium batteries, Pallet, Saturday Pickup, etc.) because
      // they don't carry the courier flag in the master table.
      const res = await masterSupplementsService.list({
        sped_ckbox: "S",
        autosize: "N",
        fisso: "N",
        picker_manual: "S",
      });
      if (res.success && Array.isArray(res.data)) {
        catalog.value = res.data;
        loaded.value = true;
      } else {
        catalog.value = [];
        error.value = res.error ?? "Failed to load supplements catalog";
        toasts.push("error", error.value);
      }
    } catch (e) {
      error.value = (e as Error).message;
      toasts.push("error", error.value);
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    catalog.value = [];
    loaded.value = false;
    error.value = null;
  }

  return {
    catalog,
    loading,
    loaded,
    error,
    byGroup,
    expressVisible,
    ensureLoaded,
    reset,
  };
});
