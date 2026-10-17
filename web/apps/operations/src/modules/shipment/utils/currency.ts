/**
 * Re-export del formateo de moneda compartido. `formatMoney` mantiene el estilo
 * italiano ("€ 1.234,56") que ya usaban los consumidores de esta app; la
 * implementación vive ahora en @shared/utils/format (fuente única).
 */
export { formatMoneyIT as formatMoney } from "@shared/utils/format";
