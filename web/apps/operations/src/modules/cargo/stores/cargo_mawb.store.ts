import { defineStore } from "pinia";
import { ref } from "vue";
import { cargoMawbService } from "@cargo/services/cargo_mawb.service";
import { useToastStore } from "./toast.store";
import type {
  CargoMawb,
  CargoMawbPatch,
} from "@cargo/services/cargo_mawb.types";

export const useCargoMawbStore = defineStore("cargo_mawb", () => {
  const mawb = ref<CargoMawb | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  async function load(cargo_id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      mawb.value = await cargoMawbService.get(cargo_id);
    } catch (e) {
      error.value = (e as Error).message;
      mawb.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Serialisation tail. Every patch() chains onto the previous one so two
   * edits saved in quick succession reach the backend in the order the
   * operator made them — and their responses can never be applied out of
   * order (which would resurrect an older value).
   */
  let queue: Promise<unknown> = Promise.resolve();

  /**
   * Timestamp of the last write applied to `mawb`, used to drop stale
   * responses. Monotonic counter rather than a clock (Date.now() has 1 ms
   * granularity and two patches can land inside the same millisecond).
   */
  let writeSeq = 0;

  async function patch(
    cargo_id: number,
    body: CargoMawbPatch,
  ): Promise<boolean> {
    const run = queue.then(() => doPatch(cargo_id, body));
    // Keep the tail alive even when this patch rejects, otherwise one failure
    // would wedge every later save behind a rejected promise.
    queue = run.catch(() => undefined);
    return run;
  }

  async function doPatch(
    cargo_id: number,
    body: CargoMawbPatch,
  ): Promise<boolean> {
    saving.value = true;
    const seq = ++writeSeq;
    try {
      const updated = await cargoMawbService.patch(cargo_id, body);
      // Merge instead of replacing: keeping the same object identity stops the
      // shipper/consignee/notify computeds from producing a fresh reference on
      // every save, which is what used to clobber in-flight edits.
      if (mawb.value && seq === writeSeq) Object.assign(mawb.value, updated);
      else if (!mawb.value) mawb.value = updated;
      // Success is signalled inline by the form (dirty marker clearing); a
      // toast per field was pure noise. Errors below still surface loudly.
      return true;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      // Only the newest write clears the flag, so the progress bar stays up
      // for the whole burst rather than flickering between queued patches.
      if (seq === writeSeq) saving.value = false;
    }
  }

  return { mawb, loading, saving, error, load, patch };
});
