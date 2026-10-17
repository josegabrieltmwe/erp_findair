import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { paymentsApi } from "../services/payments.service";
import type {
  ConfirmMatch,
  ConfirmResult,
  MatchedItem,
  ReconciliationResult,
  StatementFormat,
} from "../types";

/** Línea propuesta por el análisis, editable antes de confirmar. */
export interface MatchLine {
  key: string;
  item: MatchedItem;
  accepted: boolean;
  /** Importe a aplicar (positivo). Menor que la cuota = cobro parcial. */
  amount: number;
}

/** Fecha de cierre de una línea: la del movimiento bancario (YYYY-MM-DD). */
export function closeDate(item: MatchedItem): string {
  return String(item.transaction.date ?? "").slice(0, 10);
}

/** Importe a aplicar por defecto: el menor entre el movimiento y la cuota. */
export function defaultAmount(item: MatchedItem): number {
  return Math.min(
    Math.abs(item.transaction.amount),
    Number(item.pagamento.importo),
  );
}

/** Convierte las líneas aceptadas al cuerpo del PUT; omite `amount` si es el total. */
export function buildConfirmMatches(lines: MatchLine[]): ConfirmMatch[] {
  return lines
    .filter((l) => l.accepted)
    .map((l) => {
      const m: ConfirmMatch = {
        pagamento_id: l.item.pagamento.id,
        transaction_ref: l.item.transaction.reference,
        data_close: closeDate(l.item),
      };
      if (l.amount > 0 && l.amount < Number(l.item.pagamento.importo)) {
        m.amount = Math.round(l.amount * 100) / 100;
      }
      return m;
    });
}

/** Validación de una línea: importe positivo y no superior a la cuota. */
export function isLineValid(l: MatchLine): boolean {
  return l.amount > 0 && l.amount <= Number(l.item.pagamento.importo) + 0.005;
}

export const useReconciliationStore = defineStore(
  "payments_reconciliation",
  () => {
    const analysis = ref<ReconciliationResult | null>(null);
    const lines = ref<MatchLine[]>([]);
    const analyzing = ref(false);
    const confirming = ref(false);
    const error = ref<string | null>(null);
    const result = ref<ConfirmResult | null>(null);

    const acceptedCount = computed(
      () => lines.value.filter((l) => l.accepted).length,
    );
    const canConfirm = computed(
      () =>
        acceptedCount.value > 0 &&
        lines.value.every((l) => !l.accepted || isLineValid(l)),
    );

    function setAnalysis(res: ReconciliationResult): void {
      analysis.value = res;
      result.value = null;
      lines.value = res.matched.map((m, i) => ({
        key: `${i}-${m.pagamento.id}`,
        item: m,
        accepted: true,
        amount: defaultAmount(m),
      }));
    }

    async function analyze(
      file: File,
      opts: { format?: StatementFormat | ""; delimiter?: string },
    ): Promise<boolean> {
      analyzing.value = true;
      error.value = null;
      try {
        setAnalysis(await paymentsApi.reconcileFile(file, opts));
        return true;
      } catch (e) {
        analysis.value = null;
        lines.value = [];
        error.value = e instanceof Error ? e.message : String(e);
        return false;
      } finally {
        analyzing.value = false;
      }
    }

    async function confirm(): Promise<ConfirmResult | null> {
      if (!canConfirm.value) return null;
      confirming.value = true;
      error.value = null;
      try {
        const res = await paymentsApi.confirmMatches(
          buildConfirmMatches(lines.value),
        );
        result.value = res;
        // Las líneas ya confirmadas salen de la lista; las que fallaron se quedan.
        const failed = new Set(res.errors.map((e) => e.pagamento_id));
        lines.value = lines.value.filter(
          (l) => !l.accepted || failed.has(l.item.pagamento.id),
        );
        return res;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        return null;
      } finally {
        confirming.value = false;
      }
    }

    function reset(): void {
      analysis.value = null;
      lines.value = [];
      result.value = null;
      error.value = null;
    }

    return {
      analysis,
      lines,
      analyzing,
      confirming,
      error,
      result,
      acceptedCount,
      canConfirm,
      analyze,
      confirm,
      reset,
      setAnalysis,
    };
  },
);
