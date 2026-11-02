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
  /** El cargo tiene factura (cliente o proveedor): el servidor responde 409 CARGO_INVOICED. No se puede forzar. */
  invoiced: boolean;
  /** Hay AWB (MAWB) asignado: solo el personal de TMWE lo salta con `force` (CARGO_HAS_AWB). */
  hasAwb: boolean;
  /** Hay reserva viva con la aerolínea: 409 CARGO_HAS_ACTIVE_BOOKING; hay que cancelar antes la reserva. */
  hasActiveBooking: boolean;
  /** Confirmar cancelación deshabilitado por el estado del cargo (facturado o reserva viva). */
  blocked: boolean;
  /** El único motivo es el AWB y quien actúa puede forzar: se pide confirmación explícita. */
  needsForce: boolean;
}

/**
 * Lo que la SPA adelanta de las reglas de `Cargo_Cancel_Guard` (P43) para no ofrecer una acción condenada. La
 * decisión es siempre del servidor: si el 409 llega igual, se muestra su motivo (`cancelBlockFromServer`).
 */
export function cancelCargoState(
  cargo: {
    id_fattura_a?: string | number | null;
    id_fattura_p?: string | number | null;
    AWB_forn?: string | null;
  } | null,
  hasActiveBooking: boolean,
  canForce = false,
): CancelCargoState {
  const invoiced =
    Number(cargo?.id_fattura_a ?? 0) > 0 ||
    Number(cargo?.id_fattura_p ?? 0) > 0;
  const hasAwb = (cargo?.AWB_forn ?? "").trim() !== "";
  const blocked = invoiced || hasActiveBooking;
  return {
    invoiced,
    hasAwb,
    hasActiveBooking,
    blocked,
    needsForce: hasAwb && canForce && !blocked,
  };
}

export type CancelServerOutcome = "blocked" | "needs_force" | "error";

/**
 * Qué hacer con un 409 de cancelar cargo según su código: facturado y reserva viva bloquean; el AWB emitido pide
 * confirmación de `force` a quien puede forzar (personal de TMWE) y bloquea al resto.
 */
export function cancelBlockFromServer(
  code: string | null | undefined,
  canForce: boolean,
): CancelServerOutcome {
  if (code === "CARGO_INVOICED" || code === "CARGO_HAS_ACTIVE_BOOKING") {
    return "blocked";
  }
  if (code === "CARGO_HAS_AWB") return canForce ? "needs_force" : "blocked";
  return "error";
}

/** ¿Se puede pulsar «cancelar cargo»? Falta la casilla de forzar cuando el AWB exige confirmación. */
export function canSubmitCancel(s: {
  hasCargoId: boolean;
  blocked: boolean;
  needsForce: boolean;
  forceAck: boolean;
  loading: boolean;
}): boolean {
  if (!s.hasCargoId || s.loading || s.blocked) return false;
  if (s.needsForce && !s.forceAck) return false;
  return true;
}

/** Datos del 409 que ayudan al usuario: qué facturas, qué reserva, qué AWB. */
export function cancelBlockDetail(
  code: string | null | undefined,
  details: Record<string, unknown>,
): { key: string; params: Record<string, string> } | null {
  const str = (v: unknown): string =>
    v == null || v === "" ? "" : String(v);
  if (code === "CARGO_HAS_AWB" && str(details.awb)) {
    return {
      key: "cargo.cancelmodal.detail_awb",
      params: { awb: str(details.awb) },
    };
  }
  if (code === "CARGO_HAS_ACTIVE_BOOKING") {
    const id = str(details.booking_id);
    if (!id) return null;
    return {
      key: "cargo.cancelmodal.detail_booking",
      params: { carrier: str(details.carrier).toUpperCase(), id },
    };
  }
  if (code === "CARGO_INVOICED") {
    const ids = [details.id_fattura_a, details.id_fattura_p]
      .map(str)
      .filter((v) => v !== "" && v !== "0");
    if (!ids.length) return null;
    return {
      key: "cargo.cancelmodal.detail_invoiced",
      params: { ids: ids.join(", ") },
    };
  }
  return null;
}
