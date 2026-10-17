import { http } from "./http";

/**
 * Catálogo de estados de entrega (consegna_stato) = tracking_pubblico.id.
 * `consegna_stato` es un FK int a tracking_pubblico, NO un enum fijo ni texto
 * libre. Se pide con `scope=all` porque el estado puede ser uno no-P (p.ej.
 * 7=Delivered tipo 'D', 6=Delivering tipo 'C'), que el endpoint por defecto
 * (solo tipo 'P') no incluye.
 */
export interface DeliveryStatus {
  id: number;
  description: string;
}

let cache: DeliveryStatus[] | null = null;
let inFlight: Promise<DeliveryStatus[]> | null = null;

export const deliveryStatusService = {
  async list(): Promise<DeliveryStatus[]> {
    if (cache) return cache;
    if (inFlight) return inFlight;
    inFlight = http<{ items: DeliveryStatus[] }>("/get-tracking-status-list", {
      query: { scope: "all" },
    })
      .then((r) => {
        cache = Array.isArray(r?.items) ? r.items : [];
        return cache;
      })
      .catch(() => {
        cache = null;
        return [];
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
};
