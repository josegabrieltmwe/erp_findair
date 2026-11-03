import { useI18n } from "vue-i18n";
import { formatMoney, formatNumber } from "../logic";

/** Importes y números con el idioma activo de la interfaz (E7). */
export function useFormat() {
  const { locale } = useI18n();
  return {
    money: (
      v: number | null | undefined,
      cur: string | null | undefined,
    ): string => formatMoney(v, cur, String(locale.value)),
    num: (v: number | null | undefined, digits = 2): string =>
      formatNumber(v, String(locale.value), digits),
  };
}
