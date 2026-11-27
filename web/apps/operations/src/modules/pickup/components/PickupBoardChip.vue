<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { pickupAddress } from "../logic";
import type { Pickup } from "../types";

/**
 * Una presa en el tablero de autistas (U-14 / U-15 / U-16): el número y, si se pide, a quién y dónde va el autista
 * (la sede o la dirección de la expedición, la misma que el borderò) y el contacto (persona y teléfono). El email,
 * el cliente si no es quien está en la dirección y la dirección completa salen al pasar el ratón. Sin `direccion`
 * (API anterior) se ve solo el número, como antes.
 */
const props = withDefaults(
  defineProps<{
    pickup: Pickup;
    showAddress?: boolean;
    color?: string;
    /** Texto tras el número cuando no se muestra la dirección (sede y bultos en «sin asignar»). */
    suffix?: string;
  }>(),
  { showAddress: true, color: "primary", suffix: "" },
);
defineEmits<{ click: [] }>();

const { t } = useI18n();

const address = computed(() =>
  props.showAddress ? pickupAddress(props.pickup) : null,
);

const idText = computed(
  () => `#${props.pickup.id}${address.value ? "" : props.suffix}`,
);

const ORIGIN_ICON: Record<string, string> = {
  sede: "mdi-office-building-outline",
  expedicion: "mdi-package-variant-closed",
  sede_sin_expedicion: "mdi-alert-outline",
};

const tooltip = computed(() => {
  const a = address.value;
  if (!a) return undefined;
  const parts = [t(`pickup.schedule.origin.${a.origin}`), a.full];
  if (a.client) parts.push(t("pickup.schedule.client", { name: a.client }));
  if (a.contact) parts.push(t("pickup.schedule.contact", { value: a.contact }));
  if (a.email) parts.push(t("pickup.schedule.email", { value: a.email }));
  if (a.distinct > 0) {
    parts.push(t("pickup.schedule.distinct_addresses", { n: a.distinct }));
  }
  return parts.join("\n");
});
</script>

<template>
  <button
    type="button"
    class="pk-board-chip"
    :class="[`pk-board-chip--${color}`, { 'pk-board-chip--wide': address }]"
    :title="tooltip"
    data-testid="board-pickup"
    @click="$emit('click')"
  >
    <span class="pk-board-chip-head">
      <span class="pk-board-chip-id">{{ idText }}</span>
      <span
        v-if="address?.name"
        class="pk-board-chip-name"
        data-testid="board-name"
        >{{ address.name }}</span
      >
    </span>
    <span v-if="address" class="pk-board-chip-addr" data-testid="board-address">
      <v-icon
        :icon="ORIGIN_ICON[address.origin] ?? ORIGIN_ICON.sede"
        :color="address.warning ? 'warning' : undefined"
        size="12"
        :data-origin="address.origin"
        data-testid="board-address-origin"
      />
      <span class="pk-board-chip-line">{{ address.line }}</span>
      <v-icon
        v-if="address.distinct > 0"
        icon="mdi-map-marker-multiple-outline"
        color="warning"
        size="12"
        data-testid="board-address-distinct"
      />
    </span>
    <span
      v-if="address?.contact"
      class="pk-board-chip-addr"
      data-testid="board-contact"
    >
      <v-icon icon="mdi-phone-outline" size="12" />
      <span class="pk-board-chip-line">{{ address.contact }}</span>
    </span>
  </button>
</template>

<style scoped>
.pk-board-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 100%;
  margin: 2px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}
.pk-board-chip--warning {
  background: rgba(var(--v-theme-warning), 0.14);
  color: rgb(var(--v-theme-warning));
}
.pk-board-chip--wide {
  display: flex;
  width: calc(100% - 4px);
}
.pk-board-chip:hover {
  filter: brightness(0.95);
}
.pk-board-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 1px;
}
.pk-board-chip-head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  max-width: 100%;
}
.pk-board-chip-id {
  font-weight: 600;
  white-space: nowrap;
}
.pk-board-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}
.pk-board-chip-addr {
  display: flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  color: rgba(var(--v-theme-on-surface), 0.75);
}
.pk-board-chip-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
