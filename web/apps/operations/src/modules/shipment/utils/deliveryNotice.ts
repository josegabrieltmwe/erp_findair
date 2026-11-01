/** Registro de estado "consegnata" en tracking_pubblico (legacy `dlv=7`). */
export const DELIVERED_STATO = "7";

/** ¿El envío está marcado como entregado y con fecha de entrega? */
export function isDeliveredWithDate(
  stato: unknown,
  data: unknown,
): boolean {
  return String(stato) === DELIVERED_STATO && String(data ?? "").trim() !== "";
}

/**
 * Cuándo se puede enviar el aviso de entrega. El servidor lee los datos
 * guardados en BD, así que con un borrador activo (modal Estado, always-draft)
 * no se envía: se deja pendiente hasta que el borrador se confirme.
 */
export function deliveryNoticeAction(opts: {
  hasId: boolean;
  stato: unknown;
  data: unknown;
  draftActive: boolean;
}): "none" | "defer" | "ask" {
  if (!opts.hasId || !isDeliveredWithDate(opts.stato, opts.data)) return "none";
  return opts.draftActive ? "defer" : "ask";
}
