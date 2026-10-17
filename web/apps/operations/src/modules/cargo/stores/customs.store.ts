import { defineStore } from "pinia";
import { ref } from "vue";
import {
  customsService,
  type AgencyOption,
  type ShareRecipient,
} from "@cargo/services/customs.service";
import { useToastStore } from "./toast.store";

/**
 * Ephemeral state for the customs box and the share-MAWB dialog on
 * the cargo detail page.
 *
 * Not persisted; reset between cargo loads. Decoupled from the main
 * cargo store because the agencies/recipients lists are pure lookups
 * with their own loading lifecycle.
 */
export const useCustomsStore = defineStore("customs", () => {
  const exportAgencies = ref<AgencyOption[]>([]);
  const importAgencies = ref<AgencyOption[]>([]);
  const customsReadonly = ref(false);
  const isoFrom = ref("");
  const isoDest = ref("");

  const recipients = ref<ShareRecipient[]>([]);

  const loadingBox = ref(false);
  const loadingRecipients = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  async function fetchBox(cargo_id: number): Promise<void> {
    if (!cargo_id) return;
    loadingBox.value = true;
    error.value = null;
    try {
      const res = await customsService.loadBox(cargo_id);
      if (res.success && res.data) {
        exportAgencies.value = res.data.agencies.export;
        importAgencies.value = res.data.agencies.import;
        customsReadonly.value = res.data.readonly;
        isoFrom.value = res.data.iso_from;
        isoDest.value = res.data.iso_dest;
      } else {
        exportAgencies.value = [];
        importAgencies.value = [];
        error.value = res.error ?? "Failed to load customs box";
        toasts.push("error", error.value);
      }
    } catch (e) {
      error.value = (e as Error).message;
      toasts.push("error", error.value);
    } finally {
      loadingBox.value = false;
    }
  }

  async function fetchRecipients(cargo_id: number): Promise<void> {
    if (!cargo_id) return;
    loadingRecipients.value = true;
    error.value = null;
    try {
      const res = await customsService.loadRecipients(cargo_id);
      if (res.success && res.data) {
        recipients.value = res.data.recipients;
      } else {
        recipients.value = [];
        error.value = res.error ?? "Failed to load recipients";
        toasts.push("error", error.value);
      }
    } catch (e) {
      recipients.value = [];
      error.value = (e as Error).message;
      toasts.push("error", error.value);
    } finally {
      loadingRecipients.value = false;
    }
  }

  function reset(): void {
    exportAgencies.value = [];
    importAgencies.value = [];
    recipients.value = [];
    customsReadonly.value = false;
    isoFrom.value = "";
    isoDest.value = "";
    error.value = null;
  }

  return {
    // state
    exportAgencies,
    importAgencies,
    customsReadonly,
    isoFrom,
    isoDest,
    recipients,
    loadingBox,
    loadingRecipients,
    error,
    // actions
    fetchBox,
    fetchRecipients,
    reset,
  };
});
