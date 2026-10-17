import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref } from "vue";
import {
  filesService,
  type CargoFile,
  type FileScope,
  type FileRecipient,
} from "@cargo/services/files.service";
import { useToastStore } from "./toast.store";

/**
 * Cargo files store — wraps filesService. Keeps the two scopes (external /
 * internal) cached separately so the UI can show both sections without
 * refetching. Replaces the legacy spedy_files.php / spedy_files2.php flow.
 */
export const useCargoFilesStore = defineStore("cargo_files", () => {
  const ext = ref<CargoFile[]>([]);
  const int = ref<CargoFile[]>([]);
  const loading = ref(false);
  const uploading = ref(false);
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  function bucket(scope: FileScope) {
    return scope === "int" ? int : ext;
  }

  async function refresh(
    cargo_id: number,
    scope: FileScope = "ext",
  ): Promise<void> {
    if (!cargo_id) return;
    loading.value = true;
    error.value = null;
    try {
      const r = await filesService.list(cargo_id, scope);
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
    }
  }

  /** Load both scopes (called on mount). */
  async function refreshAll(cargo_id: number): Promise<void> {
    await Promise.all([refresh(cargo_id, "ext"), refresh(cargo_id, "int")]);
  }

  async function upload(
    cargo_id: number,
    file: File,
    descrizione: string,
    scope: FileScope,
  ): Promise<void> {
    uploading.value = true;
    try {
      const r = await filesService.upload(cargo_id, file, descrizione, scope);
      if (r.success) {
        toasts.push("success", i18n.global.t("cargo.toast.file_uploaded"));
        await refresh(cargo_id, scope);
      } else {
        toasts.push("error", r.error ?? "Errore caricamento");
      }
    } finally {
      uploading.value = false;
    }
  }

  async function remove(
    cargo_id: number,
    file_id: number,
    scope: FileScope,
  ): Promise<void> {
    const r = await filesService.remove(cargo_id, file_id, scope);
    if (r.success) {
      toasts.push("success", i18n.global.t("cargo.toast.file_deleted"));
      await refresh(cargo_id, scope);
    } else {
      toasts.push("error", r.error ?? "Errore eliminazione");
    }
  }

  async function setVisibility(
    cargo_id: number,
    file_id: number,
    recipient: FileRecipient,
    visible: boolean,
  ): Promise<void> {
    // Optimistic toggle on the cached ext row.
    const row = ext.value.find((f) => f.id === file_id);
    const key = `show_${recipient}` as keyof CargoFile;
    const prev = row ? (row[key] as boolean | undefined) : undefined;
    if (row) (row as Record<string, unknown>)[key] = visible;

    const r = await filesService.setVisibility(
      cargo_id,
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

  function downloadUrl(cargo_id: number, file: CargoFile): string {
    return filesService.downloadUrl(cargo_id, file.id, file.otp, file.scope);
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
