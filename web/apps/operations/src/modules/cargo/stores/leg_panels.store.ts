/**
 * Paneles laterales de los tramos del cargo: izquierda = recogida (pickup), derecha = entrega (delivery).
 *
 * Ambos paneles reutilizan el detalle de expedición (ShipmentDetailDrawer), que lee el shipment.store compartido:
 * solo uno puede estar abierto a la vez. Abrir uno cierra el otro; abrir el que ya está abierto lo oculta.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type CargoLegRole = "pickup" | "delivery";

/** Lado del panel por tramo: la recogida a la izquierda, la entrega a la derecha. */
export const LEG_SIDE: Record<CargoLegRole, "left" | "right"> = { pickup: "left", delivery: "right" };

export const useLegPanelsStore = defineStore("cargo_leg_panels", () => {
  const openRole = ref<CargoLegRole | null>(null);

  const isOpen = (role: CargoLegRole) => computed(() => openRole.value === role);

  function open(role: CargoLegRole): void {
    openRole.value = role;
  }
  function close(): void {
    openRole.value = null;
  }
  function toggle(role: CargoLegRole): void {
    openRole.value = openRole.value === role ? null : role;
  }

  return { openRole, isOpen, open, close, toggle };
});
