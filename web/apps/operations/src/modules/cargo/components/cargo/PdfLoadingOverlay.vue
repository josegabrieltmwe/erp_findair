<template>
  <!--
    Full-viewport overlay shown while a PDF document is being generated
    by `/api_awb_documents` (or any other long-running PDF endpoint).
    Bound to `usePdfLoadingStore` so any component can activate it just
    by importing the store — no prop drilling. Teleported to <body> so
    z-index isn't trapped under the dashboard topbar.

    Backed by transition for fade-in/out (legacy overlay is a hard
    show/hide; the soft fade reads less janky on cancellation).
  -->
  <Teleport to="body">
    <transition name="pdf-overlay-fade">
      <div
        v-if="store.isLoading"
        class="pdf-overlay"
        role="status"
        aria-live="polite"
      >
        <div class="pdf-overlay-box">
          <v-progress-circular
            indeterminate
            size="48"
            width="4"
            color="primary"
          />
          <div class="pdf-overlay-title">{{ store.currentLabel }}</div>
          <div class="pdf-overlay-sub">
            Rendering — usually takes 2-8 seconds.
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { usePdfLoadingStore } from "@cargo/stores/pdf_loading.store";

const store = usePdfLoadingStore();
</script>

<style scoped lang="scss">
.pdf-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Block clicks on the page below while the PDF is being generated;
     prevents the operator from triggering a second render mid-flight. */
  cursor: progress;
}

.pdf-overlay-box {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  padding: 28px 36px;
  border-radius: 14px;
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 280px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.pdf-overlay-title {
  font-size: 14px;
  font-weight: 700;
  margin-top: 4px;
  text-align: center;
}

.pdf-overlay-sub {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: center;
  opacity: 0.8;
}

/* Fade transitions */
.pdf-overlay-fade-enter-active,
.pdf-overlay-fade-leave-active {
  transition: opacity 0.15s ease;
}
.pdf-overlay-fade-enter-from,
.pdf-overlay-fade-leave-to {
  opacity: 0;
}
</style>
