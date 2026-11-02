/**
 * Dominio real de `spedizioni.checkforn` (enum O/V/K/X/R/A, valor por defecto O; verificado en el
 * esquema, en tmwe_api `Billing_Enums` y en el legacy `spedy_ajax_list.php`):
 *
 *  - O  por controlar (valor por defecto; NULL o un valor fuera del enum se tratan igual).
 *  - V  verificado: el coste real esta dentro de la tolerancia (RN-40).
 *  - K  sobrecoste: coste real > previsto + 0,05.
 *  - X, R, A  ciclo de abono del proveedor (legacy «storni»): por pedir, pedido, recibido.
 *
 * No confundir con `spedizioni.stato` (A activa / O eliminada): son columnas distintas y `O` en
 * `checkforn` no significa eliminada. Antes la tarjeta comparaba con 'OK', un valor que no existe,
 * y el indicador no se encendia nunca.
 */
export const CHECKFORN_VALUES = ["O", "V", "K", "X", "R", "A"] as const;
export type CheckfornValue = (typeof CHECKFORN_VALUES)[number];

/**
 * Solo V da por buena la factura del proveedor. K, X y R son diferencias abiertas; A es un abono ya
 * recibido (la diferencia existio y se resolvio), asi que no se muestra como verificada.
 */
const CHECKFORN_OK: ReadonlySet<string> = new Set(["V"]);

export function isCheckfornOk(value: string | null | undefined): boolean {
  return CHECKFORN_OK.has(String(value ?? "").trim().toUpperCase());
}

/** Clave i18n del texto del valor (`shipment.checkforn.opt_x`), o null si esta vacio o es desconocido. */
export function checkfornLabelKey(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim().toUpperCase();
  return (CHECKFORN_VALUES as readonly string[]).includes(v)
    ? `shipment.checkforn.opt_${v.toLowerCase()}`
    : null;
}
