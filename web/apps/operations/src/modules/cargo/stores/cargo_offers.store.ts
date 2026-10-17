import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref, computed } from "vue";
import {
  cargoOffersService,
  type CargoOffer,
  type OfferCreate,
  type OfferPatch,
  type DistributeRfqRequest,
} from "@cargo/services/cargo_offers.service";
import { useToastStore } from "./toast.store";

/**
 * WS-4 — Pinia store for carrier offers (`spedizioni_cargo_off`).
 *
 * The companion service already speaks the parent
 * Cargo_Offer_Controller REST contract; this store keeps the list in
 * memory, surfaces a per-row `saving` set so inline editors can
 * disable inputs, and emits toast feedback consistently with the other
 * cargo stores (charges, MAWB, HAWB).
 */
export const useCargoOffersStore = defineStore("cargo_offers", () => {
  const rows = ref<CargoOffer[]>([]);
  const loading = ref(false);
  const saving = ref<Set<number>>(new Set());
  const error = ref<string | null>(null);

  const toasts = useToastStore();

  const total = computed(() => rows.value.length);
  const accepted = computed(
    () => rows.value.find((r) => r.accettata === "S") ?? null,
  );

  function markSaving(id: number): void {
    saving.value.add(id);
    saving.value = new Set(saving.value);
  }
  function clearSaving(id: number): void {
    saving.value.delete(id);
    saving.value = new Set(saving.value);
  }

  async function load(cargo_id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const r = await cargoOffersService.list(cargo_id);
      rows.value = r.success && r.data ? r.data.offers : [];
    } catch (e) {
      error.value = (e as Error).message;
      rows.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function create(body: OfferCreate): Promise<number | null> {
    try {
      const r = await cargoOffersService.create(body);
      if (r.success && r.data?.id) {
        await load(Number(body.cargo_id));
        toasts.push("success", i18n.global.t("cargo.toast.offer_created"));
        return r.data.id;
      }
      toasts.push("error", r.error ?? "Create failed");
      return null;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return null;
    }
  }

  /**
   * Distribute RFQ — picks N carriers and sends a templated mail per
   * carrier. The backend writes one offer row per carrier; we reload to
   * surface them.
   */
  async function distribute(
    cargo_id: number,
    body: DistributeRfqRequest,
  ): Promise<boolean> {
    try {
      const r = await cargoOffersService.distribute(body);
      if (r.success && r.data) {
        await load(cargo_id);
        const sent = r.data.sent ?? 0;
        toasts.push(
          "success",
          `RFQ sent to ${sent} carrier${sent === 1 ? "" : "s"}`,
        );
        return true;
      }
      toasts.push("error", r.error ?? "Failed to distribute RFQ");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    }
  }

  async function update(patch: OfferPatch): Promise<boolean> {
    markSaving(patch.id);
    try {
      const r = await cargoOffersService.update(patch);
      if (r.success) {
        // Apply the patch locally — the API returns only {id} so we
        // merge the fields we sent.
        const idx = rows.value.findIndex(
          (row) => Number(row.id) === Number(patch.id),
        );
        if (idx >= 0) {
          const next = { ...rows.value[idx], ...patch } as CargoOffer;
          rows.value = [
            ...rows.value.slice(0, idx),
            next,
            ...rows.value.slice(idx + 1),
          ];
        }
        toasts.push("success", i18n.global.t("cargo.toast.offer_saved"));
        return true;
      }
      toasts.push("error", r.error ?? "Update failed");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      clearSaving(patch.id);
    }
  }

  async function remove(offer_id: number): Promise<boolean> {
    try {
      const r = await cargoOffersService.remove(offer_id);
      if (r.success) {
        rows.value = rows.value.filter((row) => Number(row.id) !== offer_id);
        toasts.push("success", i18n.global.t("cargo.toast.offer_removed"));
        return true;
      }
      toasts.push("error", r.error ?? "Delete failed");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    }
  }

  /**
   * Mark a single offer as the winner. The backend `Cargo_Offer_Service`
   * exposes the same field on update; we wrap it here so the UI can
   * call `acceptWinner(id)` semantically without rebuilding the patch.
   */
  async function acceptWinner(offer_id: number): Promise<boolean> {
    return update({ id: offer_id, accettata: "S", controllata: "S" });
  }

  return {
    rows,
    loading,
    saving,
    error,
    total,
    accepted,
    load,
    create,
    distribute,
    update,
    remove,
    acceptWinner,
  };
});
