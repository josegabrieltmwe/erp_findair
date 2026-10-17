import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { currencyService } from "@cargo/services/currency.service";
import {
  useTargetCurrency as useTargetCurrencyShared,
  type TargetCurrency,
} from "@tmwe/shared-frontend/composables/useTargetCurrency";

/**
 * Cargo wrapper around the shared target-currency composable. Injects the cargo
 * store getters + the cargo currency service. See the shared implementation for
 * the conversion semantics.
 */
export function useTargetCurrency(): TargetCurrency {
  const { cargo } = storeToRefs(useCargoStore());
  return useTargetCurrencyShared({
    getClientId: () => cargo.value?.id_cliente,
    getShipmentDate: () => cargo.value?.data_sped0,
    getTargetCurrency: (id) => currencyService.getTargetCurrency(id),
    getDayRates: (date) => currencyService.getDayRates(date),
  });
}
