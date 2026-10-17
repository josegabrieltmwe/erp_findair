import { computed, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useShipmentStore } from "@shipment/stores/shipment.store";

/**
 * Derives the 5-step lifecycle of a shipment from the columns the
 * backend ships:
 *
 *   1. Creata        — always done (the row exists)
 *   2. Lavorazione   — data_sped0 ≤ now and not yet dispatched
 *   3. Spedita       — data_corriere set (i.e. handed to the courier)
 *   4. Consegnata    — consegna_stato='C' or consegna_data set
 *   5. Fatturata     — id_fattura_a > 0
 *
 * Used by the mini-status bar in the topbar and by the full Stato
 * modal in v2. Mirrors the lifecycle the legacy spedy_form lays
 * out via the timeline strip.
 */

export type LifecycleStepState = "done" | "now" | "todo";

export interface LifecycleStep {
  key: "creata" | "lavorazione" | "spedita" | "consegnata" | "fatturata";
  label: string;
  state: LifecycleStepState;
  date: string | null;
}

export function useShipmentLifecycle(): {
  steps: ComputedRef<LifecycleStep[]>;
  segments: ComputedRef<LifecycleStepState[]>;
  currentLabel: ComputedRef<string>;
  currentDate: ComputedRef<string>;
} {
  const store = useShipmentStore();
  const { shipment } = storeToRefs(store);
  const { t } = useI18n();
  const lbl = (key: LifecycleStep["key"]) =>
    t(`enums.shipment_lifecycle.${key}`);

  function fmt(d: string | null | undefined): string | null {
    if (!d) return null;
    // Accept legacy YYYY-MM-DD or full datetime; print compact dd MMM
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const year = m[1];
    const monthIdx = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    const MONTHS = [
      "gen",
      "feb",
      "mar",
      "apr",
      "mag",
      "giu",
      "lug",
      "ago",
      "set",
      "ott",
      "nov",
      "dic",
    ];
    if (monthIdx < 0 || monthIdx > 11) return null;
    return `${day} ${MONTHS[monthIdx]}${year !== String(new Date().getFullYear()) ? " '" + year.slice(-2) : ""}`;
  }

  function isEmpty(v: unknown): boolean {
    if (v == null) return true;
    if (typeof v === "string")
      return (
        v.trim() === "" ||
        v === "0" ||
        v === "0000-00-00" ||
        v.startsWith("0000-00-00")
      );
    if (typeof v === "number") return v === 0;
    return false;
  }

  const steps = computed<LifecycleStep[]>(() => {
    const s = shipment.value;
    if (!s) {
      return [
        { key: "creata", label: lbl("creata"), state: "todo", date: null },
        {
          key: "lavorazione",
          label: lbl("lavorazione"),
          state: "todo",
          date: null,
        },
        { key: "spedita", label: lbl("spedita"), state: "todo", date: null },
        {
          key: "consegnata",
          label: lbl("consegnata"),
          state: "todo",
          date: null,
        },
        {
          key: "fatturata",
          label: lbl("fatturata"),
          state: "todo",
          date: null,
        },
      ];
    }

    const dataSped0 = (s as { data_sped0?: string }).data_sped0 || null;
    const dataCorriere =
      (s as { data_corriere?: string }).data_corriere || null;
    const consegnaData =
      (s as { consegna_data?: string }).consegna_data || null;
    const consegnaStato =
      (s as { consegna_stato?: string }).consegna_stato || "";
    const idFatturaA = Number(
      (s as { id_fattura_a?: string | number }).id_fattura_a ?? 0,
    );

    const creataDone = true; // row exists
    const dispatched = !isEmpty(dataCorriere);
    const delivered = consegnaStato === "C" || !isEmpty(consegnaData);
    const invoiced = idFatturaA > 0;

    // 'now' is the first non-done step.
    const flags = [
      creataDone,
      !dispatched && !delivered && !invoiced,
      dispatched && !delivered,
      delivered && !invoiced,
      invoiced,
    ];

    // Build state for each step.
    function stateOf(idx: number): LifecycleStepState {
      // idx 0 = creata
      if (idx === 0) return "done";
      if (idx === 1) {
        // lavorazione: done only if dispatched
        if (dispatched || delivered || invoiced) return "done";
        return creataDone ? "now" : "todo";
      }
      if (idx === 2) {
        if (delivered || invoiced) return "done";
        if (dispatched) return dispatched && !delivered ? "now" : "done";
        return "todo";
      }
      if (idx === 3) {
        if (invoiced) return "done";
        if (delivered) return "now";
        return "todo";
      }
      if (idx === 4) {
        return invoiced ? "done" : "todo";
      }
      return "todo";
    }

    // If everything is 'done' until 4 but 4 isn't, mark 4 as 'now'.
    const result: LifecycleStep[] = [
      {
        key: "creata",
        label: lbl("creata"),
        state: stateOf(0),
        date: fmt(dataSped0),
      },
      {
        key: "lavorazione",
        label: lbl("lavorazione"),
        state: stateOf(1),
        date: dispatched ? null : t("shipment.lifecycle.in_progress"),
      },
      {
        key: "spedita",
        label: lbl("spedita"),
        state: stateOf(2),
        date: fmt(dataCorriere),
      },
      {
        key: "consegnata",
        label: lbl("consegnata"),
        state: stateOf(3),
        date: fmt(consegnaData),
      },
      {
        key: "fatturata",
        label: lbl("fatturata"),
        state: stateOf(4),
        date: invoiced ? `#${idFatturaA}` : null,
      },
    ];

    // Ensure exactly one 'now' for the bar. If none, mark the last 'todo'.
    if (!result.some((r) => r.state === "now")) {
      const firstTodo = result.findIndex((r) => r.state === "todo");
      if (firstTodo >= 0) result[firstTodo].state = "now";
    }
    void flags; // intentionally unused — kept for future fine-tuning
    return result;
  });

  const segments = computed<LifecycleStepState[]>(() =>
    steps.value.map((s) => s.state),
  );

  const currentLabel = computed<string>(() => {
    const now = steps.value.find((s) => s.state === "now");
    if (now) return now.label;
    // All done.
    return steps.value[steps.value.length - 1].label;
  });

  const currentDate = computed<string>(() => {
    const now = steps.value.find((s) => s.state === "now");
    return (now?.date ?? "") || "";
  });

  return { steps, segments, currentLabel, currentDate };
}
