import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref } from "vue";
import {
  cargoHawbService,
  type HawbRow,
  type HawbCreate,
  type HawbPatch,
} from "@cargo/services/cargo_hawb.service";
import { useToastStore } from "./toast.store";

export const useCargoHawbStore = defineStore("cargo_hawb", () => {
  const rows = ref<HawbRow[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const toasts = useToastStore();

  async function load(cargo_id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const r = await cargoHawbService.list(cargo_id);
      rows.value = r.items ?? [];
    } catch (e) {
      error.value = (e as Error).message;
      rows.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function create(
    cargo_id: number,
    body: HawbCreate,
  ): Promise<HawbRow | null> {
    saving.value = true;
    try {
      const created = await cargoHawbService.create(cargo_id, body);
      rows.value = [...rows.value, created];
      toasts.push("success", i18n.global.t("cargo.toast.hawb_created"));
      return created;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    cargo_id: number,
    hawb_id: number,
    body: HawbPatch,
  ): Promise<boolean> {
    saving.value = true;
    try {
      const updated = await cargoHawbService.update(cargo_id, hawb_id, body);
      const idx = rows.value.findIndex((r) => Number(r.id) === hawb_id);
      if (idx >= 0) {
        rows.value = [
          ...rows.value.slice(0, idx),
          updated,
          ...rows.value.slice(idx + 1),
        ];
      }
      toasts.push("success", i18n.global.t("cargo.toast.hawb_saved"));
      return true;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function remove(cargo_id: number, hawb_id: number): Promise<boolean> {
    saving.value = true;
    try {
      await cargoHawbService.remove(cargo_id, hawb_id);
      rows.value = rows.value.filter((r) => Number(r.id) !== hawb_id);
      toasts.push("success", i18n.global.t("cargo.toast.hawb_removed"));
      return true;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { rows, loading, saving, error, load, create, update, remove };
});
