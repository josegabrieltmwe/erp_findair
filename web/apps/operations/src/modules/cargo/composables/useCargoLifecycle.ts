import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";

/**
 * Derives the cargo 5-step lifecycle from the columns the backend
 * ships. Mirrors the shipment_express lifecycle composable but with
 * the air-freight specific steps:
 *
 *   1. Creata          — always done (the row exists in spedizioni_cargo)
 *   2. Lavorazione     — handler/terminal assigned, waiting for flight
 *   3. In volo         — data_volo_partenza set
 *   4. Consegnata      — consegna_data set or handler_data_cons set
 *   5. Fatturata       — id_fattura_a > 0
 */

export type LifecycleStepState = "done" | "now" | "todo";

export interface LifecycleStep {
  key: "creata" | "lavorazione" | "in_volo" | "consegnata" | "fatturata";
  label: string;
  state: LifecycleStepState;
  date: string | null;
}

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

function fmt(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = m[1];
  const monthIdx = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  if (monthIdx < 0 || monthIdx > 11) return null;
  return `${day} ${MONTHS[monthIdx]}${year !== String(new Date().getFullYear()) ? " '" + year.slice(-2) : ""}`;
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") {
    return v.trim() === "" || v === "0" || v.startsWith("0000-00-00");
  }
  if (typeof v === "number") return v === 0;
  return false;
}

export function useCargoLifecycle(): {
  steps: ComputedRef<LifecycleStep[]>;
  segments: ComputedRef<LifecycleStepState[]>;
  currentLabel: ComputedRef<string>;
  currentDate: ComputedRef<string>;
} {
  const store = useCargoStore();
  const { t } = useI18n();
  const { cargo } = storeToRefs(store);
  const lbl = (key: LifecycleStep["key"]) => t(`enums.cargo_lifecycle.${key}`);

  const steps = computed<LifecycleStep[]>(() => {
    const c = cargo.value;
    if (!c) {
      return [
        { key: "creata", label: lbl("creata"), state: "todo", date: null },
        {
          key: "lavorazione",
          label: lbl("lavorazione"),
          state: "todo",
          date: null,
        },
        { key: "in_volo", label: lbl("in_volo"), state: "todo", date: null },
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

    const dataSped0 = (c.data_sped0 as string | undefined) || null;
    const dataVoloPartenza =
      (c.data_volo_partenza as string | undefined) || null;
    const dataVoloArrivo = (c.data_volo_arrivo as string | undefined) || null;
    const consegnaData = (c.consegna_data as string | undefined) || null;
    const handlerDataCons = (c.handler_data_cons as string | undefined) || null;
    const idFatturaA = Number(c.id_fattura_a ?? 0);

    const creataDone = true;
    const flying = !isEmpty(dataVoloPartenza);
    const landed = !isEmpty(dataVoloArrivo);
    const delivered = !isEmpty(consegnaData) || !isEmpty(handlerDataCons);
    const invoiced = idFatturaA > 0;

    function stateOf(idx: number): LifecycleStepState {
      if (idx === 0) return "done";
      if (idx === 1) {
        if (flying || landed || delivered || invoiced) return "done";
        return "now";
      }
      if (idx === 2) {
        if (landed || delivered || invoiced) return "done";
        if (flying) return "now";
        return "todo";
      }
      if (idx === 3) {
        if (invoiced) return "done";
        if (delivered) return "now";
        if (landed) return "now";
        return "todo";
      }
      if (idx === 4) {
        return invoiced ? "done" : "todo";
      }
      return "todo";
    }

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
        date: flying ? null : t("cargo.lifecycle.in_progress"),
      },
      {
        key: "in_volo",
        label: lbl("in_volo"),
        state: stateOf(2),
        date: fmt(dataVoloPartenza),
      },
      {
        key: "consegnata",
        label: lbl("consegnata"),
        state: stateOf(3),
        date: fmt(consegnaData) ?? fmt(handlerDataCons),
      },
      {
        key: "fatturata",
        label: lbl("fatturata"),
        state: stateOf(4),
        date: invoiced ? `#${idFatturaA}` : null,
      },
    ];

    if (!result.some((r) => r.state === "now")) {
      const firstTodo = result.findIndex((r) => r.state === "todo");
      if (firstTodo >= 0) result[firstTodo].state = "now";
    }
    return result;
  });

  const segments = computed<LifecycleStepState[]>(() =>
    steps.value.map((s) => s.state),
  );
  const currentLabel = computed<string>(() => {
    const now = steps.value.find((s) => s.state === "now");
    if (now) return now.label;
    return steps.value[steps.value.length - 1].label;
  });
  const currentDate = computed<string>(() => {
    const now = steps.value.find((s) => s.state === "now");
    return (now?.date ?? "") || "";
  });

  return { steps, segments, currentLabel, currentDate };
}
