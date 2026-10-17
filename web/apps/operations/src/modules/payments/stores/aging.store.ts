import { defineStore } from "pinia";
import { ref } from "vue";
import { isAbortLikeError } from "@tmwe/shared-frontend/http";
import { paymentsApi } from "../services/payments.service";
import type { AgingResult } from "../types";

export const useAgingStore = defineStore("payments_aging", () => {
  const data = ref<AgingResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const customerId = ref<number | null>(null);
  let ctrl: AbortController | null = null;

  async function load(): Promise<void> {
    ctrl?.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    loading.value = true;
    error.value = null;
    try {
      const res = await paymentsApi.aging(
        { customerId: customerId.value },
        signal,
      );
      if (signal.aborted) return;
      data.value = res;
    } catch (e) {
      if (isAbortLikeError(e, signal)) return;
      error.value = "load_failed";
      data.value = null;
    } finally {
      if (!signal.aborted) loading.value = false;
    }
  }

  function setCustomer(id: number | null): void {
    customerId.value = id;
    void load();
  }

  return { data, loading, error, customerId, load, setCustomer };
});
