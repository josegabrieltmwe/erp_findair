import { defineStore } from "pinia";
import { ref } from "vue";
import {
  expressOffersService,
  type ExpressOffer,
} from "@shipment/services/express_offers.service";
import { useToastStore } from "./toast.store";

/**
 * Courier RFQ store — courier counterpart of cargo_offers.store.ts.
 * Owns the list of RFQs sent for a shipment and the distribute/patch/remove
 * actions, delegating toasts to useToastStore.
 */
export const useExpressOffersStore = defineStore("express_offers", () => {
  const offers = ref<ExpressOffer[]>([]);
  const loading = ref(false);
  const distributing = ref(false);
  const toasts = useToastStore();

  async function load(shipmentId: number): Promise<void> {
    loading.value = true;
    try {
      offers.value = await expressOffersService.list(shipmentId);
    } finally {
      loading.value = false;
    }
  }

  async function distribute(
    shipmentId: number,
    courierIds: number[],
    rfqText: string,
    fileIds: number[] = [],
    extraEmails: string[] = [],
    cc: string[] = [],
    bodyHtml?: string,
  ): Promise<{ ok: boolean; sent: number; errors: string[] }> {
    distributing.value = true;
    try {
      const r = await expressOffersService.distribute(
        shipmentId,
        courierIds,
        rfqText,
        fileIds,
        extraEmails,
        cc,
        bodyHtml,
      );
      if (r.success) {
        const sent = r.data?.sent ?? 0;
        // Refresca el listado (badge/vista); el feedback lo da el composer.
        await load(shipmentId);
        return { ok: true, sent, errors: r.data?.errors ?? [] };
      }
      // Detalle del backend (p.ej. "courier X: Courier RFQ email not found").
      const detail =
        (r as { details?: { errors?: string[] } }).details?.errors ?? [];
      const msg = detail.length
        ? detail.join("; ")
        : (r.error ?? "Failed to distribute RFQ");
      return { ok: false, sent: 0, errors: [msg] };
    } finally {
      distributing.value = false;
    }
  }

  async function patch(
    offerId: number,
    p: Partial<ExpressOffer>,
  ): Promise<boolean> {
    const r = await expressOffersService.update(offerId, p);
    if (r.success) {
      const idx = offers.value.findIndex((o) => Number(o.id) === offerId);
      if (idx >= 0) offers.value[idx] = { ...offers.value[idx], ...p };
      return true;
    }
    toasts.push("error", r.error ?? "Update failed");
    return false;
  }

  async function remove(offerId: number): Promise<boolean> {
    const r = await expressOffersService.remove(offerId);
    if (r.success) {
      offers.value = offers.value.filter((o) => Number(o.id) !== offerId);
      return true;
    }
    toasts.push("error", r.error ?? "Delete failed");
    return false;
  }

  /**
   * Acepta una oferta como ganadora. Recarga la lista para reflejar la
   * exclusividad (solo una queda aceptada). Devuelve el aviso de coste si el
   * envío estaba bloqueado (facturado/precio-lock).
   */
  async function acceptOffer(
    offerId: number,
    shipmentId: number,
  ): Promise<{ ok: boolean; costApplied: boolean; warning: string | null }> {
    const r = await expressOffersService.accept(offerId);
    if (r.success) {
      await load(shipmentId);
      return {
        ok: true,
        costApplied: r.data?.cost_applied ?? false,
        warning: r.data?.cost_warning ?? null,
      };
    }
    toasts.push("error", r.error ?? "Accept failed");
    return { ok: false, costApplied: false, warning: null };
  }

  /**
   * Cancela la selección de la oferta ganadora: desmarca y limpia el proveedor/
   * coste de la expedición. Recarga la lista.
   */
  async function resetOffer(
    offerId: number,
    shipmentId: number,
  ): Promise<{
    ok: boolean;
    warning: string | null;
    awbCanceled: boolean;
    awbWarning: string | null;
  }> {
    const r = await expressOffersService.reset(offerId);
    if (r.success) {
      await load(shipmentId);
      return {
        ok: true,
        warning: r.data?.cost_warning ?? null,
        awbCanceled: r.data?.awb_canceled ?? false,
        awbWarning: r.data?.awb_warning ?? null,
      };
    }
    toasts.push("error", r.error ?? "Reset failed");
    return { ok: false, warning: null, awbCanceled: false, awbWarning: null };
  }

  return {
    offers,
    loading,
    distributing,
    load,
    distribute,
    patch,
    remove,
    acceptOffer,
    resetOffer,
  };
});
