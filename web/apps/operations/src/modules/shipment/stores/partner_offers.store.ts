import { defineStore } from "pinia";
import { ref } from "vue";
import {
  partnerOffersService,
  type PartnerOffer,
} from "@shipment/services/partner_offers.service";
import { useToastStore } from "./toast.store";

/**
 * Store de ofertas a PARTNER (spedizioni_off dest_tipo='P'). Gemelo de
 * express_offers.store pero sin volcado de coste (un partner no es el
 * fornitore courier). Alimenta el badge y el modal "ver respuestas".
 */
export const usePartnerOffersStore = defineStore("partner_offers", () => {
  const offers = ref<PartnerOffer[]>([]);
  const loading = ref(false);
  const toasts = useToastStore();

  async function load(shipmentId: number): Promise<void> {
    loading.value = true;
    try {
      offers.value = await partnerOffersService.list(shipmentId);
    } finally {
      loading.value = false;
    }
  }

  /** Acepta una oferta partner como ganadora. Recarga para reflejar la exclusividad. */
  async function acceptOffer(
    offerId: number,
    shipmentId: number,
  ): Promise<boolean> {
    const r = await partnerOffersService.accept(offerId);
    if (r.success) {
      await load(shipmentId);
      return true;
    }
    toasts.push("error", r.error ?? "Accept failed");
    return false;
  }

  return { offers, loading, load, acceptOffer };
});
