import { defineStore } from "pinia";
import { ref } from "vue";
import {
  filesService,
  type ShipmentFileRow,
  type FileScope,
  type FileRecipient,
} from "@shipment/services/files.service";
import { useToastStore } from "./toast.store";

/**
 * Express shipment files store — wraps filesService. Keeps the two scopes
 * (external / internal) cached separately so the UI can show both sections
 * without refetching. Replaces the legacy spedy_files.php / spedy_files2.php
 * flow. Same shape as the cargo files store; only the endpoint differs.
 */
export const useShipmentFilesStore = defineStore("shipment_files", () => {
  const ext = ref<ShipmentFileRow[]>([]);
  const int = ref<ShipmentFileRow[]>([]);
  const loading = ref(false);
  const uploading = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  function bucket(scope: FileScope) {
    return scope === "int" ? int : ext;
  }

  // In-flight de-dupe: if a refresh for the same (shipment, scope) is already
  // running, reuse its promise instead of firing a second overlapping request.
  const inFlight = new Map<string, Promise<void>>();

  async function refresh(
    shipment_id: number,
    scope: FileScope = "ext",
  ): Promise<void> {
    if (!shipment_id) return;
    const key = `${shipment_id}:${scope}`;
    const pending = inFlight.get(key);
    if (pending) return pending;

    const run = (async () => {
      loading.value = true;
      error.value = null;
      try {
        const r = await filesService.list(shipment_id, scope);
        if (r.success) {
          bucket(scope).value = r.files;
        } else {
          bucket(scope).value = [];
          error.value = r.error ?? "Errore caricamento file";
        }
      } catch (e) {
        error.value = (e as Error).message;
      } finally {
        loading.value = false;
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, run);
    return run;
  }

  async function refreshAll(shipment_id: number): Promise<void> {
    await Promise.all([
      refresh(shipment_id, "ext"),
      refresh(shipment_id, "int"),
    ]);
  }

  async function upload(
    shipment_id: number,
    file: File,
    descrizione: string,
    scope: FileScope,
  ): Promise<void> {
    uploading.value = true;
    try {
      const r = await filesService.upload(
        shipment_id,
        file,
        descrizione,
        scope,
      );
      if (r.success) {
        toasts.push("success", "File caricato");
        await refresh(shipment_id, scope);
      } else {
        toasts.push("error", r.error ?? "Errore caricamento");
      }
    } finally {
      uploading.value = false;
    }
  }

  async function remove(
    shipment_id: number,
    file_id: number,
    scope: FileScope,
  ): Promise<void> {
    const r = await filesService.remove(shipment_id, file_id, scope);
    if (r.success) {
      toasts.push("success", "File eliminato");
      await refresh(shipment_id, scope);
    } else {
      toasts.push("error", r.error ?? "Errore eliminazione");
    }
  }

  async function setVisibility(
    shipment_id: number,
    file_id: number,
    recipient: FileRecipient,
    visible: boolean,
  ): Promise<void> {
    const row = ext.value.find((f) => f.id === file_id);
    const key = `show_${recipient}` as keyof ShipmentFileRow;
    const prev = row ? (row[key] as boolean | undefined) : undefined;
    if (row) (row as Record<string, unknown>)[key] = visible;

    const r = await filesService.setVisibility(
      shipment_id,
      file_id,
      recipient,
      visible,
    );
    if (!r.success) {
      if (row && prev !== undefined)
        (row as Record<string, unknown>)[key] = prev;
      toasts.push("error", r.error ?? "Errore visibilità");
    }
  }

  function downloadUrl(shipment_id: number, file: ShipmentFileRow): string {
    return filesService.downloadUrl(shipment_id, file.id, file.otp, file.scope);
  }

  return {
    ext,
    int,
    loading,
    uploading,
    error,
    refresh,
    refreshAll,
    upload,
    remove,
    setVisibility,
    downloadUrl,
  };
});
