import { watch, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  pricingService,
  type PricingRecalcResult,
} from "@cargo/services/pricing.service";

/**
 * Auto-recalc cargo pricing when the operator changes weight, flight
 * leg or currency-related fields. Mirrors the legacy ReCalc() chain
 * driven by Detail box changes — but reactive instead of imperative.
 *
 * Trigger fields:
 *   - peso, pesor, colli                    → 'weight'
 *     (cargo's chargeable weight is `pesor`, NOT `peso_tassato` — that column
 *      only exists on express `spedizioni`.)
 *   - flight_num1..5                        → 'flight'
 *   - change_valuta(_costo), change_rate(_costo) → 'currency'
 *
 * Skip rules:
 *   - cargo.ricalcola_volo === 'N' → user disabled auto-recalc.
 *   - cargo.carico_volo_lk === 'S' AND cargo.costo_volo_previsto_lk === 'S' → both prices locked.
 *   - In-flight call already pending.
 *
 * Behaviour:
 *   - Debounced 800ms so rapid edits collapse into one request.
 *   - Cargo store gets re-loaded on success so downstream cards show
 *     the new values (carico_volo, costo_volo_previsto, etc.).
 *   - Toasts surface only errors; success is silent (the values
 *     update in place).
 */

const DEBOUNCE_MS = 800;

export function usePricingRecalc() {
  const cargoStore = useCargoStore();
  const { cargo } = storeToRefs(cargoStore);
  const toasts = useToastStore();

  const inFlight = ref(false);
  const lastResult = ref<PricingRecalcResult | null>(null);
  let timer: number | null = null;
  let pendingTrigger: "weight" | "flight" | "currency" | "manual" = "manual";

  function shouldSkip(): boolean {
    const c = cargo.value;
    if (!c?.id) return true;
    if (c.ricalcola_volo === "N") return true;
    if (c.carico_volo_lk === "S" && c.costo_volo_previsto_lk === "S")
      return true;
    return false;
  }

  function schedule(
    trigger: "weight" | "flight" | "currency" | "manual",
  ): void {
    if (shouldSkip()) return;
    pendingTrigger = trigger;
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void run();
    }, DEBOUNCE_MS);
  }

  async function run(): Promise<PricingRecalcResult | null> {
    if (inFlight.value) return null;
    const c = cargo.value;
    if (!c?.id) return null;
    inFlight.value = true;
    try {
      const r = await pricingService.recalculate({
        cargo_id: Number(c.id),
        trigger: pendingTrigger,
      });
      lastResult.value = r;
      if (!r.success) {
        if (r.error) toasts.push("error", `Recalc fallito: ${r.error}`);
        return r;
      }
      // Backend already wrote to spedizioni_cargo. Re-load to show
      // the new values in every consumer card.
      await cargoStore.load(Number(c.id));
      return r;
    } finally {
      inFlight.value = false;
    }
  }

  // ─── Watchers ──────────────────────────────────────────────────
  watch(
    () => [cargo.value?.peso, cargo.value?.pesor, cargo.value?.colli],
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule("weight");
    },
  );

  watch(
    () => [
      cargo.value?.flight_num1,
      cargo.value?.flight_num2,
      cargo.value?.flight_num3,
      cargo.value?.flight_num4,
      cargo.value?.flight_num5,
    ],
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule("flight");
    },
  );

  watch(
    () => [
      cargo.value?.change_valuta,
      cargo.value?.change_valuta_costo,
      cargo.value?.change_rate,
      cargo.value?.change_rate_costo,
    ],
    (next, prev) => {
      if (!prev || JSON.stringify(next) === JSON.stringify(prev)) return;
      schedule("currency");
    },
  );

  onUnmounted(() => {
    if (timer !== null) clearTimeout(timer);
  });

  return {
    inFlight,
    lastResult,
    schedule,
    run,
  };
}
