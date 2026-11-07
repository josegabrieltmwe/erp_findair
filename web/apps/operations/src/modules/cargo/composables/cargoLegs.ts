/**
 * Tramos de un cargo: la expedición de recogida (`id_spediz_part`) y la de entrega (`id_spediz_dest`) que señala el
 * propio cargo. Puro (sin Vue) para probarlo.
 */
import type { CargoLegRole } from "@cargo/stores/leg_panels.store";

interface CargoLegPointers {
  id_spediz_part?: string | number | null;
  id_spediz_dest?: string | number | null;
}

/** Id de la expedición del tramo, o null si el cargo aún no la tiene. */
export function legShipmentId(cargo: CargoLegPointers | null | undefined, role: CargoLegRole): number | null {
  if (!cargo) return null;
  const n = Number(role === "pickup" ? cargo.id_spediz_part : cargo.id_spediz_dest);
  return Number.isFinite(n) && n > 0 ? n : null;
}
