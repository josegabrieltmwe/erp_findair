<template>
  <!-- Botones de la barra superior: abren u ocultan el panel del tramo (recogida a la izquierda, entrega a la derecha). -->
  <button
    v-for="role in roles"
    :key="role"
    type="button"
    class="topbar-iconbtn"
    :class="{ 'topbar-iconbtn--active': panels.openRole === role }"
    :title="buttonTitle(role)"
    :disabled="!legShipmentId(cargo.cargo, role)"
    :data-testid="`cargo-leg-btn-${role}`"
    @click="panels.toggle(role)"
  >
    <v-icon :icon="role === 'pickup' ? 'mdi-arrow-up-right' : 'mdi-arrow-down-right'" size="18" />
  </button>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useLegPanelsStore, type CargoLegRole } from "@cargo/stores/leg_panels.store";
import { legShipmentId } from "@cargo/composables/cargoLegs";

const { t } = useI18n();
const cargo = useCargoStore();
const panels = useLegPanelsStore();
const roles: CargoLegRole[] = ["pickup", "delivery"];

function buttonTitle(role: CargoLegRole): string {
  if (!legShipmentId(cargo.cargo, role)) return t(`cargo.legs.none_${role}`);
  return panels.openRole === role ? t(`cargo.legs.hide_${role}`) : t(`cargo.legs.show_${role}`);
}
</script>
