import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoiceService, type Invoice } from "../services/invoice.service";
import { einvoiceService, type SdiStatus } from "../services/einvoice.service";
import { useToastStore } from "./toast.store";
import { capabilities, audience } from "../services/http";
import { canTransmit } from "../services/invoiceActions";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";

export const useInvoiceStore = defineStore("invoice", () => {
  const invoice = ref<Invoice | null>(null);
  const sdi = ref<SdiStatus | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();
  let ctrl: AbortController | null = null;

  const id = computed<number | null>(() =>
    invoice.value ? Number(invoice.value.id) : null,
  );
  /** La factura está bloqueada (transmitida) → no editable. */
  const locked = computed<boolean>(() => !!sdi.value?.locked);

  async function load(invoiceId: number): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const [inv, status] = await Promise.all([
        invoiceService.getById(invoiceId, signal),
        einvoiceService.sdiStatus(invoiceId, signal).catch(() => null),
      ]);
      if (signal.aborted) return;
      invoice.value = inv;
      sdi.value = status;
    } catch (e) {
      // Abort (petición superada o página descargándose) → silencio.
      if (isAbortLikeError(e, signal)) return;
      error.value = String(e);
      toasts.push("error", "No se pudo cargar la factura");
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  async function recalculate(): Promise<void> {
    if (!id.value || locked.value) return;
    saving.value = true;
    try {
      await invoiceService.recalculate(id.value);
      await load(id.value);
      toasts.push("success", "Totales recalculados");
    } catch (e) {
      toasts.push("error", String(e));
    } finally {
      saving.value = false;
    }
  }

  async function transmit(): Promise<void> {
    if (!id.value || !canTransmit(capabilities(), audience())) return;
    saving.value = true;
    try {
      const res = await einvoiceService.transmit(id.value);
      toasts.push("success", `Transmitida (${res.state})`);
      await load(id.value);
    } catch (e) {
      toasts.push("error", String(e));
    } finally {
      saving.value = false;
    }
  }

  /**
   * Collaudo 13/11, item 10: antes nadie podia poner un identificador manual
   * (p. ej. "1938/A") en una factura activa — la nota de credito que
   * referencia la original caia siempre al numero plano.
   */
  async function updateNumeroAlfanum(value: string): Promise<boolean> {
    if (!id.value || locked.value) return false;
    const trimmed = value.trim();
    saving.value = true;
    try {
      await invoiceService.update(id.value, { numero_alfanum: trimmed });
      await load(id.value);
      toasts.push("success", "Guardado");
      return true;
    } catch (e) {
      toasts.push("error", String(e));
      return false;
    } finally {
      saving.value = false;
    }
  }

  function reset(): void {
    ctrl?.abort();
    invoice.value = null;
    sdi.value = null;
    error.value = null;
  }

  return {
    invoice,
    sdi,
    loading,
    saving,
    error,
    id,
    locked,
    load,
    recalculate,
    transmit,
    updateNumeroAlfanum,
    reset,
  };
});
