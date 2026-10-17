import { computed, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";

/**
 * Reactive margin / profitability metrics for the active shipment.
 *
 *   margin     = charged - cost
 *   marginPct  = margin / charged * 100  (when charged > 0)
 *
 * The legacy spedy_form surfaces this in the cost band ("MarkUp € · Profit").
 * The v2 mockup shows it in the Costi card KPI row + the
 * "Detail importi" accordion.
 *
 * Numbers come from the modern Shipment_Express_Update_Service which
 * already normalises legacy currency columns (carico vs costo) into
 * the canonical billing pair returned by /ajax_shipment_crud.
 */
export function useMargin(): {
  cost: ComputedRef<number>;
  charged: ComputedRef<number>;
  margin: ComputedRef<number>;
  marginPct: ComputedRef<number | null>;
  marginColor: ComputedRef<"success" | "warning" | "error" | "medium">;
  markup: ComputedRef<number>;
  profit: ComputedRef<number | null>;
} {
  const store = useShipmentStore();
  const { shipment } = storeToRefs(store);

  function num(field: keyof Record<string, unknown> | string): number {
    const v = (shipment.value as unknown as Record<string, unknown> | null)?.[
      field
    ];
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  // Cost: supplier-side total. Legacy uses `costo` (current cost) and
  // `costor` (real cost after supplier invoice). Prefer real when set.
  const cost = computed<number>(() => {
    const real = num("costor");
    if (real > 0) return real;
    return num("costo");
  });

  // Charged: client-side total. `carico` is the canonical billed amount;
  // we add the fuel surcharge when surfaced separately.
  const charged = computed<number>(() => {
    const base = num("carico");
    return base; // fuel/etc already baked in via carico_lk recalc upstream
  });

  const margin = computed<number>(() =>
    Number((charged.value - cost.value).toFixed(2)),
  );

  const marginPct = computed<number | null>(() => {
    if (charged.value <= 0) return null;
    return Number(((margin.value / charged.value) * 100).toFixed(1));
  });

  const marginColor = computed<"success" | "warning" | "error" | "medium">(
    () => {
      if (marginPct.value == null) return "medium";
      if (marginPct.value < 0) return "error";
      if (marginPct.value < 15) return "warning";
      return "success";
    },
  );

  // Paridad legacy spedy_form.php:246-247,292-293 — dos cifras distintas:
  //   MarkUp (previsto) = (carico + fuel_surc) − (costo + fuel_surc_cst)
  //   Profit (real)     = (carico + fuel_surc) − costor   [solo si costor > 0]
  // El "margin" de arriba se conserva para compat, pero card/modal deben
  // mostrar MarkUp y Profit por separado, con fórmula única entre ambos.
  const chargedFull = computed<number>(() => num("carico") + num("fuel_surc"));
  const markup = computed<number>(() =>
    Number(
      (chargedFull.value - (num("costo") + num("fuel_surc_cst"))).toFixed(2),
    ),
  );
  const profit = computed<number | null>(() => {
    const real = num("costor");
    if (real <= 0) return null;
    return Number((chargedFull.value - real).toFixed(2));
  });

  return { cost, charged, margin, marginPct, marginColor, markup, profit };
}
