import { reactive, watch } from "vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import type { Shipment } from "@shipment/services/shipment.types";
import type { FieldBinding } from "./useFieldBinding";

/**
 * Binding para campos de divisa donde el valor que se MUESTRA/edita es la sigla
 * ISO (EUR/USD…) pero la columna destino puede ser distinta:
 *
 *  - `id_valuta_assic`  → columna varchar(3): lee y escribe la MISMA sigla.
 *  - `id_valuta_dogana` → columna int FK a valute.id: se lee la sigla resuelta
 *    por el backend (`dogana_valuta`) y se escribe la sigla en `id_valuta_dogana`;
 *    el backend (normalize_cod) la traduce a valute.id al persistir.
 *  - `id_valuta_contras` → int FK: lee `contras_valuta`, escribe `id_valuta_contras`.
 *
 * Sin esto, un autocomplete de siglas hidratado desde la columna int mostraría
 * el id crudo ("3") en vez de la sigla, y persistir la sigla en la columna int
 * la corrompía a 0 (arreglado en el backend + este binding).
 *
 * @param readField  campo del objeto shipment que trae la sigla ya resuelta
 * @param writeField columna a la que se hace commit (el backend resuelve sigla→id)
 * @param fallback   sigla por defecto (normalmente 'EUR')
 */
export function useCurrencyFieldBinding(
  readField: keyof Shipment,
  writeField: keyof Shipment,
  fallback = "EUR",
): FieldBinding<string> {
  const store = useShipmentStore();

  const binding = reactive({
    local: fallback,
    async commit(): Promise<void> {
      const current = store.shipment?.[readField];
      if (binding.local === current) return;
      await store.update({ [writeField]: binding.local } as Partial<Shipment>);
    },
  }) as FieldBinding<string>;

  watch(
    () => store.shipment?.[readField],
    (v) => {
      binding.local = ((v as string | undefined) ?? fallback) || fallback;
    },
    { immediate: true },
  );

  return binding;
}
