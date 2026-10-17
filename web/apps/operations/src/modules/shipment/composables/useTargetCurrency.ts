import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { currencyService } from "@shipment/services/currency.service";
import {
  useTargetCurrency as useTargetCurrencyShared,
  type TargetCurrency,
} from "@tmwe/shared-frontend/composables/useTargetCurrency";

/**
 * Express wrapper around the shared target-currency composable. Injects the
 * shipment store getters + the express currency service.
 */
export function useTargetCurrency(): TargetCurrency {
  const { shipment } = storeToRefs(useShipmentStore());
  return useTargetCurrencyShared({
    getClientId: () => shipment.value?.id_cliente,
    getShipmentDate: () => shipment.value?.data_sped0,
    getTargetCurrency: (id) => currencyService.getTargetCurrency(id),
    getDayRates: (date) => currencyService.getDayRates(date),
  });
}
