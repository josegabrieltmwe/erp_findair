<template>
  <v-dialog
    :model-value="visible"
    persistent
    width="280"
    scrim="black"
    :scrim-opacity="0.35"
  >
    <v-card class="busy-card" role="status" aria-live="polite" aria-busy="true">
      <v-card-text class="busy-body">
        <v-progress-circular indeterminate color="primary" size="40" width="4" />
        <span class="busy-label">{{ t(state.labelKey) }}</span>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  getBusyState,
  subscribeBusy,
  type BusyState,
} from "@tmwe/shared-frontend/http";

// Las acciones rápidas no parpadean: el modal aparece tras SHOW_DELAY_MS y, una vez
// visible, se mantiene MIN_VISIBLE_MS para que no se vea como un destello.
const SHOW_DELAY_MS = 300;
const MIN_VISIBLE_MS = 400;

const { t } = useI18n();
const state = ref<BusyState>(getBusyState());
const visible = ref(false);
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let shownAt = 0;

function apply(next: BusyState): void {
  state.value = next;
  if (next.active) {
    clearTimeout(hideTimer);
    hideTimer = undefined;
    if (!visible.value && showTimer === undefined) {
      showTimer = setTimeout(() => {
        showTimer = undefined;
        visible.value = true;
        shownAt = Date.now();
      }, SHOW_DELAY_MS);
    }
    return;
  }
  clearTimeout(showTimer);
  showTimer = undefined;
  if (visible.value) {
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
    hideTimer = setTimeout(() => {
      hideTimer = undefined;
      visible.value = false;
    }, wait);
  }
}

const stop = subscribeBusy(apply);
apply(getBusyState());

onBeforeUnmount(() => {
  stop();
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
});

defineExpose({ visible: computed(() => visible.value) });
</script>

<style scoped>
.busy-body {
  display: flex;
  align-items: center;
  gap: var(--cm-space-lg, 16px);
  padding: var(--cm-space-lg, 16px) var(--cm-space-lg, 24px);
}
.busy-label {
  font-size: var(--cm-fs-base, 14px);
}
</style>
