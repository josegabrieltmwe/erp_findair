import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref, computed } from "vue";
import { cargoChargesService } from "@cargo/services/cargo_charges.service";
import { useToastStore } from "./toast.store";
import type {
  CargoChargeRow,
  CargoChargeCreate,
  CargoChargePatch,
} from "@cargo/services/cargo_charges.types";

/**
 * WS-A — Pinia store for `spedizioni_cargo_dett` rows.
 *
 * Owns:
 *  - the list of rows for the current cargo
 *  - per-row "saving" flag so the UI can disable inputs during PATCH
 *  - toast feedback on success / error
 *
 * Does NOT own:
 *  - the cargo id (read from `useCargoStore().id`)
 *  - the dirty-row accumulator (UI handles inline editing locally)
 */
export const useCargoChargesStore = defineStore("cargo_charges", () => {
  const rows = ref<CargoChargeRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  /** Set of item_ids currently being PATCHed (one PATCH per blur). */
  const saving = ref<Set<number>>(new Set());

  const toasts = useToastStore();

  const total = computed(() => rows.value.length);

  async function load(cargo_id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await cargoChargesService.list(cargo_id);
      rows.value = res.items;
    } catch (e) {
      error.value = (e as Error).message;
      rows.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function create(
    cargo_id: number,
    body: CargoChargeCreate,
  ): Promise<CargoChargeRow | null> {
    try {
      const created = await cargoChargesService.create(cargo_id, body);
      rows.value = [...rows.value, created];
      toasts.push("success", i18n.global.t("cargo.toast.charge_added"));
      return created;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return null;
    }
  }

  async function update(
    cargo_id: number,
    item_id: number,
    patch: CargoChargePatch,
  ): Promise<boolean> {
    saving.value.add(item_id);
    try {
      const updated = await cargoChargesService.update(
        cargo_id,
        item_id,
        patch,
      );
      const idx = rows.value.findIndex((r) => r.id === item_id);
      if (idx >= 0) {
        rows.value = [
          ...rows.value.slice(0, idx),
          updated,
          ...rows.value.slice(idx + 1),
        ];
      }
      toasts.push("success", i18n.global.t("cargo.toast.saved"));
      return true;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      saving.value.delete(item_id);
      // Force reactivity refresh — Set mutations don't trigger watchers.
      saving.value = new Set(saving.value);
    }
  }

  async function remove(cargo_id: number, item_id: number): Promise<boolean> {
    try {
      await cargoChargesService.remove(cargo_id, item_id);
      rows.value = rows.value.filter((r) => r.id !== item_id);
      toasts.push("success", i18n.global.t("cargo.toast.removed"));
      return true;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    }
  }

  return {
    rows,
    loading,
    error,
    saving,
    total,
    load,
    create,
    update,
    remove,
  };
});
