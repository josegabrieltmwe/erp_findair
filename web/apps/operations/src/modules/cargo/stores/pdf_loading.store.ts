import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * pdf_loading.store — global "PDF generation in flight" state.
 *
 * The modern AWB document endpoint (`/api_awb_documents`) takes 2-8s
 * to respond because rendering goes through a RabbitMQ worker that
 * runs wkhtmltopdf. Without feedback the operator clicks the button
 * three times in a row ("the page is frozen"), each click queues a
 * fresh worker job, and the first PDF often opens after the second
 * was already requested.
 *
 * Mirrors the legacy `awb_docs_dw_override.js` spinner overlay but
 * via a Pinia store so any component (CargoAzioniCard, the topbar
 * menu, the AWB list, future buttons in tabs we don't yet know
 * about) can flip the flag with a single import — no prop drilling.
 *
 * Multiple concurrent requests are supported via a refcount: each
 * `start()` increments, each `stop()` decrements, the overlay is
 * visible while count > 0. The label shown is the most recently
 * pushed one (operators usually only fire one PDF at a time anyway).
 */

export const usePdfLoadingStore = defineStore("pdf_loading", () => {
  /** Refcount of in-flight PDF requests. */
  const count = ref(0);
  /** Label of the most recently started PDF (shown in the overlay). */
  const currentLabel = ref<string>("Generating document…");

  const isLoading = computed<boolean>(() => count.value > 0);

  function start(label?: string): void {
    count.value += 1;
    if (label) currentLabel.value = label;
  }

  function stop(): void {
    count.value = Math.max(0, count.value - 1);
  }

  /** Hard reset — useful if a navigation aborts before stop() fires. */
  function reset(): void {
    count.value = 0;
  }

  return { count, currentLabel, isLoading, start, stop, reset };
});
