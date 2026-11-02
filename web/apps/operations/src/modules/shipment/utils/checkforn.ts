/**
 * Dominio real de `spedizioni.checkforn` (enum O/V/K/X/R/A, ver ShipmentCheckfornBox). Antes la
 * tarjeta de verificaciones comparaba con 'OK', un valor que no existe, y el indicador no se
 * encendia nunca.
 */
export const CHECKFORN_VALUES = ["O", "V", "K", "X", "R", "A"] as const;
export type CheckfornValue = (typeof CHECKFORN_VALUES)[number];

/** Estados en los que la factura del proveedor esta dada por buena: Verificato y Accettato. */
const CHECKFORN_OK: ReadonlySet<string> = new Set(["V", "A"]);

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
