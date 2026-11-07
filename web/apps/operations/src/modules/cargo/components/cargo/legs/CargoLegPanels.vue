<template>
  <!--
    Paneles laterales de los tramos del cargo (recogida a la izquierda, entrega a la derecha). Se abren bajo
    solicitud (botones de la barra superior o el bloque de envíos vinculados) y se ocultan con la x.
    El contenido es el detalle de expedición del listado courier (ShipmentDetailDrawer); se carga solo al abrir.
  -->
  <component
    :is="ShipmentDetailDrawer"
    v-for="role in roles"
    :key="role"
    :model-value="panels.openRole === role"
    :shipment-id="legId(role)"
    :location="LEG_SIDE[role]"
    :title="t(`cargo.legs.title_${role}`)"
    :icon="role === 'pickup' ? 'mdi-arrow-up-right' : 'mdi-arrow-down-right'"
    @update:model-value="
      (v: boolean) => (v ? panels.open(role) : panels.close())
    "
  />
</template>

<script setup lang="ts">
import { defineAsyncComponent, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import {
  useLegPanelsStore,
  LEG_SIDE,
  type CargoLegRole,
} from "@cargo/stores/leg_panels.store";
import { legShipmentId } from "@cargo/composables/cargoLegs";

// El detalle de expedición pesa: no entra en el bundle de la ficha hasta que se abre un tramo.
const ShipmentDetailDrawer = defineAsyncComponent(
  () => import("@shipment/components/shipment/ShipmentDetailDrawer.vue"),
);

const { t } = useI18n();
const cargo = useCargoStore();
const panels = useLegPanelsStore();
const ui = useUiStore();
const roles: CargoLegRole[] = ["pickup", "delivery"];

function legId(role: CargoLegRole): number | null {
  return legShipmentId(cargo.cargo, role);
}

// Al ocultar un panel se relee la cabecera del cargo (los importes pueden haber cambiado al operar el tramo).
watch(
  () => panels.openRole,
  (now, before) => {
    if (before && !now) void cargo.refreshQuiet();
  },
);
// El chat es el otro panel lateral de la ficha (derecha): no se muestra a la vez que un tramo. Abrir uno cierra el otro.
watch(
  () => ui.chatOpen,
  (open) => {
    if (open) panels.close();
  },
);
watch(
  () => panels.openRole,
  (role) => {
    if (role && ui.chatOpen) ui.closeAllDrawers();
  },
);
// Otro cargo: se cierra lo que hubiera abierto.
watch(
  () => cargo.id,
  () => panels.close(),
);
</script>
