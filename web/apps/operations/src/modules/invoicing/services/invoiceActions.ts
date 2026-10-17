import type { InvoicingCapabilities } from "../env";

/**
 * La acción «Transmitir» (envío al Estado) solo se ofrece a quien tiene el
 * permiso de envío y no es partner (solo lectura). El backend responde 403 si
 * no, así que ocultarla evita un error evitable.
 */
export function canTransmit(
  caps: Pick<InvoicingCapabilities, "canSend">,
  audience: "operator" | "partner" = "operator",
): boolean {
  return audience !== "partner" && caps.canSend === true;
}
