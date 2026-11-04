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

<style scoped>
/* Fases en horizontal unidas por una línea (antes sin estilos: iconos y textos apilados en vertical). */
.lifecycle-flow {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
}
.lifecycle-step {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.lifecycle-step + .lifecycle-step::before {
  content: "";
  position: absolute;
  top: 15px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  z-index: 0;
}
.lifecycle-step.done + .lifecycle-step::before,
.lifecycle-step.done + .lifecycle-step.now::before {
  background: rgb(var(--v-theme-success));
}
.lifecycle-node {
  position: relative;
  z-index: 1;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface));
  border: 2px solid rgba(var(--v-theme-on-surface), 0.2);
  color: rgba(var(--v-theme-on-surface), 0.45);
}
.lifecycle-step.done .lifecycle-node {
  border-color: rgb(var(--v-theme-success));
  background: rgb(var(--v-theme-success));
  color: rgb(var(--v-theme-on-success));
}
.lifecycle-step.now .lifecycle-node {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
.lifecycle-label {
  font-size: 12.5px;
  font-weight: 600;
}
.lifecycle-step.todo .lifecycle-label {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-weight: 500;
}
.lifecycle-date {
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
