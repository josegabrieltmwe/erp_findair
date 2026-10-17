<template>
  <!-- Thin global activity bar: visible whenever at least one AJAX request is
       in flight. Sits fixed at the very top so every async operation in the SPA
       gives the user a "working…" signal without each component wiring its own
       spinner. -->
  <Transition name="activity-fade">
    <v-progress-linear
      v-if="active"
      class="global-activity-bar"
      color="primary"
      indeterminate
      height="3"
      :aria-label="t('common.loading')"
    />
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { onHttpEvent } from "@shipment/services/http";

const { t } = useI18n();

// Count in-flight requests: each 'request-start' increments, each
// 'request-end' decrements. The bar shows while the count is > 0.
const inFlight = ref(0);
const active = ref(false);

// Small debounce so a burst of fast sequential requests doesn't flicker the
// bar on/off — it stays visible until everything settles, then hides.
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function refresh(): void {
  if (inFlight.value > 0) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    active.value = true;
  } else {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      active.value = false;
      hideTimer = null;
    }, 150);
  }
}

const stop = onHttpEvent((event) => {
  if (event === "request-start") {
    inFlight.value++;
    refresh();
  } else if (event === "request-end") {
    inFlight.value = Math.max(0, inFlight.value - 1);
    refresh();
  }
});

onBeforeUnmount(() => {
  stop();
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.global-activity-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3000; /* above app bars / dialogs scrim */
}
.activity-fade-enter-active,
.activity-fade-leave-active {
  transition: opacity 0.2s ease;
}
.activity-fade-enter-from,
.activity-fade-leave-to {
  opacity: 0;
}
</style>
