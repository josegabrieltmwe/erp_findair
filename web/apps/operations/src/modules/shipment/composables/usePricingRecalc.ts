import { watch, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";

/**
 * Auto-refresh shipment after a price-affecting field is written, so
 * downstream cards (CostiCard, ServizioCard) show the recalculated
 * carico/costo without requiring a manual reload.
 *
 * Server-side note: `Express_Shipment_Update_Service::trigger_recalculation()`
 * already queues a daemon job that updates `spedizioni` in place when peso,
 * service, address etc. change. The composable below DOES NOT call any new
 * endpoint — it only re-fetches the shipment ~800ms after a trigger field
 * mutates locally so the cached store reflects the daemon's writes.
 *
 * Trigger fields (mirroring the legacy `Calcola()` chain in spedy_form_1.php):
 *   - peso, peso_tassato, colli, volume_cliente  → 'weight'
 *   - id_servizio, id_fornitore, id_servizio_fornitore → 'service'
 *   - cap origen/destino, paese                  → 'route'
 *
 * Skip rules (paridad locks legacy):
 *   - Both `carico_lk='S'` AND `costo_previsto_lk='S'` → no recalc to fetch.
 *   - Already in-flight (avoid stampede).
 */

const DEBOUNCE_MS = 1000;

export function usePricingRecalc() {
  const store = useShipmentStore();
  const { shipment, id, draftActive } = storeToRefs(store);

  const inFlight = ref(false);
  let timer: number | null = null;
  // Wait for the FIRST successful load to settle before arming any
  // watcher. Without this, the initial fetch flips every trigger field
  // from `undefined` to its real value and immediately schedules a
  // useless recalc reload — visible in the browser as a "blink" plus a
  // second `/ajax_shipment_crud` call right after the first one
  // returns.
  let armed = false;

  function shouldSkip(): boolean {
    const s = shipment.value;
    if (!s?.id) return true;
    // A draft is open (an edit modal — e.g. Colli — has unsaved changes).
    // Reloading the shipment now would overwrite the user's buffered row/field
    // edits with stale server data (this is what silently undid a package
    // deletion mid-edit). The recalc reload happens naturally after Save, when
    // savePackages()/commitDraft() refresh the shipment.
    if (draftActive.value) return true;
    if (
      (s.carico_lk as string | undefined) === "S" &&
      (s.costo_previsto_lk as string | undefined) === "S"
    )
      return true;
    return false;
  }

  function schedule(): void {
    if (!armed) return;
    if (shouldSkip()) return;
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, DEBOUNCE_MS);
  }

  async function run(): Promise<void> {
    if (inFlight.value) return;
    // Re-check at fire time: a draft may have opened during the debounce
    // window. Never reload over unsaved edits.
    if (draftActive.value) return;
    const sid = Number(id.value ?? 0);
    if (sid <= 0) return;
    inFlight.value = true;
    try {
      await store.load(sid);
    } finally {
      inFlight.value = false;
    }
  }

  // ─── Watchers ──────────────────────────────────────────────────
  // Each watcher tracks fields the backend recognises as recalc triggers
  // in `Express_Shipment_Update_Service::should_recalc_*()`. JSON.stringify
  // is used for cheap deep-compare (peso/colli often arrive as strings).
  watch(
    () => [
      shipment.value?.peso,
      shipment.value?.peso_tassato,
      shipment.value?.colli,
      // volume_cliente lives on the shipment row but is rarely typed-only:
      (shipment.value as { volume_cliente?: string } | null)?.volume_cliente,
    ],
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule();
    },
  );

  watch(
    () => [
      shipment.value?.id_servizio,
      shipment.value?.id_fornitore,
      shipment.value?.id_servizio_fornitore,
    ],
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule();
    },
  );

  watch(
    () => {
      const s = shipment.value as {
        cap_origine?: string;
        cap_dest?: string;
        paese_origine?: string;
        paese_dest?: string;
      } | null;
      return [s?.cap_origine, s?.cap_dest, s?.paese_origine, s?.paese_dest];
    },
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule();
    },
  );

  // Arm the watchers AFTER the first successful shipment load. We wait
  // one microtask beyond the id flip so the watchers above register
  // their initial `prev` snapshot with the just-loaded values and
  // ignore the diff that fired the load itself.
  watch(
    id,
    (sid) => {
      if (sid && !armed) {
        // setTimeout (not nextTick) so the synchronous watcher cascade
        // for [peso, colli, services, route] finishes seeding `prev`
        // before we arm. Otherwise the very next field flip on the
        // initial render would still queue a recalc.
        window.setTimeout(() => {
          armed = true;
        }, 0);
      } else if (!sid) {
        armed = false;
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (timer !== null) clearTimeout(timer);
  });

  return { inFlight, schedule, run };
}
