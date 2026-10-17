import { http } from "./http";

/**
 * Carriers a client may pin to a shipment ("fissa corriere",
 * spedizioni.acc_fissa_corriere — an INT FK to anagrafiche.id, 0 = none).
 *
 * Backend: /api_selectable_carriers (Web_Selectable_Carriers_Controller),
 * legacy parity with $pll_acc_fissa_corriere in spedy_array.php
 * (anagrafiche WHERE scelta_forn IN ('BSI','BES') AND stato='A').
 */
export interface SelectableCarrier {
  id: number;
  label: string;
}

interface CarriersEnvelope {
  success?: boolean;
  data?: { carriers: SelectableCarrier[]; count: number };
}

export const selectableCarriersService = {
  async list(): Promise<SelectableCarrier[]> {
    const res = await http<CarriersEnvelope>("/api_selectable_carriers", {});
    return res?.data?.carriers ?? [];
  },
};
