<template>
  <div class="lifecycle-flow">
    <div
      v-for="(step, i) in steps"
      :key="step.key"
      class="lifecycle-step"
      :class="step.state"
    >
      <div class="lifecycle-node">
        <v-icon :icon="iconFor(step.key, step.state)" size="18" />
      </div>
      <div class="lifecycle-label">{{ step.label }}</div>
      <div class="lifecycle-date">{{ step.date ?? "—" }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useShipmentLifecycle } from "@shipment/composables/useShipmentLifecycle";

const { steps } = useShipmentLifecycle();

function iconFor(key: string, state: string): string {
  if (state === "done") return "mdi-check";
  if (state === "now") {
    if (key === "lavorazione") return "mdi-clock-outline";
    if (key === "spedita") return "mdi-truck-outline";
    if (key === "consegnata") return "mdi-check-circle-outline";
    if (key === "fatturata") return "mdi-receipt-text-outline";
    return "mdi-clock-outline";
  }
  // todo
  if (key === "spedita") return "mdi-truck-outline";
  if (key === "consegnata") return "mdi-check-circle-outline";
  if (key === "fatturata") return "mdi-receipt-text-outline";
  return "mdi-circle-outline";
}
</script>
