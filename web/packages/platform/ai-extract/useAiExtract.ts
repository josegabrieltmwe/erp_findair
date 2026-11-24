import { ref } from "vue";
import {
  AiExtractError,
  extractShipment,
  type AiExtractInput,
  type AiExtractResult,
} from "./aiExtract.service";

export type AiExtractStatus = "idle" | "extracting" | "done" | "error";

/**
 * Composable fino sobre `aiExtract.service`: un estado reactivo que cualquier pantalla puede usar (hoy el
 * Copilot, docs/plan-extraccion-ia-erp.md §2.3; mañana, quizá, un panel de consolidata) sin duplicar el
 * manejo de abort/estado/errores.
 */
export function useAiExtract() {
  const status = ref<AiExtractStatus>("idle");
  const error = ref<AiExtractError | null>(null);
  const result = ref<AiExtractResult | null>(null);

  let controller: AbortController | null = null;

  async function run(input: Omit<AiExtractInput, "signal">): Promise<AiExtractResult | null> {
    controller?.abort();
    controller = new AbortController();
    status.value = "extracting";
    error.value = null;
    result.value = null;

    try {
      const r = await extractShipment({ ...input, signal: controller.signal });
      result.value = r;
      status.value = "done";
      return r;
    } catch (e) {
      if ((e as { name?: unknown })?.name === "AbortError") {
        status.value = "idle";
        return null;
      }
      error.value =
        e instanceof AiExtractError
          ? e
          : new AiExtractError(e instanceof Error ? e.message : "Error", "unknown");
      status.value = "error";
      return null;
    }
  }

  /** Deja de esperar el resultado (no cancela el job en el backend, solo el cliente deja de preguntar). */
  function cancel(): void {
    controller?.abort();
  }

  function reset(): void {
    controller?.abort();
    status.value = "idle";
    error.value = null;
    result.value = null;
  }

  return { status, error, result, run, cancel, reset };
}
