/** Condiciones puras de los diálogos peligrosos de cargo (testeables sin DOM). */

/** Confirmar la asignación de tarifa: la casilla de la tarifa y, si hay una
 *  reserva viva que se cancelará, la casilla propia de cancelación. */
export function canConfirmFlightAssign(s: {
  confirmCheckbox: boolean;
  hasActiveBooking: boolean;
  cancelAck: boolean;
  busy: boolean;
}): boolean {
  if (s.busy || !s.confirmCheckbox) return false;
  if (s.hasActiveBooking && !s.cancelAck) return false;
  return true;
}

export interface CancelCargoState {
  /** El cargo tiene factura emitida: no se puede cancelar desde la SPA. */
  invoiced: boolean;
  /** Hay AWB (MAWB) asignado: aviso. */
  hasAwb: boolean;
  /** Hay reserva viva con la aerolínea: aviso (quedaría huérfana). */
  hasActiveBooking: boolean;
  /** Confirmar cancelación deshabilitado por el estado del cargo. */
  blocked: boolean;
}

export function cancelCargoState(
  cargo: {
    id_fattura_a?: string | number | null;
    id_fattura_a2?: string | number | null;
    AWB_forn?: string | null;
  } | null,
  hasActiveBooking: boolean,
): CancelCargoState {
  const invoiced =
    Number(cargo?.id_fattura_a ?? 0) > 0 ||
    Number(cargo?.id_fattura_a2 ?? 0) > 0;
  const hasAwb = (cargo?.AWB_forn ?? "").trim() !== "";
  return { invoiced, hasAwb, hasActiveBooking, blocked: invoiced };
}
