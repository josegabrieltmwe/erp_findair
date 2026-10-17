<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.success_title')"
    icon="mdi-check-circle-outline"
    icon-color="success"
    size="md"
    @close="emit('update:modelValue', false)"
  >
    <div class="d-flex align-center mb-3">
      <span class="text-caption text-medium-emphasis me-2">
        {{ t("shipment.awb.awb_tracking") }}
      </span>
      <code class="awb-chip">{{ tracking }}</code>
      <v-btn
        variant="text"
        size="x-small"
        icon="mdi-content-copy"
        class="ms-1"
        :title="t('shipment.awb.copy_awb')"
        @click="emit('copy', tracking)"
      />
    </div>
    <div v-if="loading" class="d-flex justify-center pa-4">
      <v-progress-circular indeterminate size="28" />
    </div>
    <div v-else-if="labels.length" class="courier-labels">
      <!-- Zoom controls: the preview is small by design (the dialog also
           carries the tracking + actions), so let the operator magnify to
           read the address without opening the PDF. -->
      <div class="courier-zoom">
        <v-btn
          icon="mdi-magnify-minus-outline"
          size="x-small"
          variant="text"
          :disabled="!zoom.canZoomOut.value"
          :title="t('shipment.awb.zoom_out')"
          @click="zoom.zoomOut"
        />
        <span class="courier-zoom__level">{{ zoom.label.value }}</span>
        <v-btn
          icon="mdi-magnify-plus-outline"
          size="x-small"
          variant="text"
          :disabled="!zoom.canZoomIn.value"
          :title="t('shipment.awb.zoom_in')"
          @click="zoom.zoomIn"
        />
        <v-btn
          icon="mdi-fit-to-page-outline"
          size="x-small"
          variant="text"
          :disabled="zoom.isFit.value"
          :title="t('shipment.awb.zoom_fit')"
          @click="zoom.reset"
        />
      </div>
      <div
        v-for="(it, i) in labels"
        :key="i"
        class="courier-label"
        :class="{ 'courier-label--zoomed': !zoom.isFit.value }"
        @wheel="zoom.onWheel"
      >
        <img
          :src="labelUrl(it, 'image')"
          alt="label"
          class="courier-label__img"
          :class="{
            'courier-label__img--rot90': rotateDeg(it) !== 0,
            'courier-label__img--loaded': loaded.has(i),
          }"
          :style="zoom.styleFor(imgStyle(it))"
          @load="onImgLoad(i)"
        />
      </div>
    </div>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('update:modelValue', false)">{{
        t("common.close")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-printer"
        :loading="printing"
        :disabled="!labels.length"
        @click="emit('print')"
      >
        {{ t("shipment.awb.print") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * "AWB generated" success dialog: shows the new tracking + an inline preview of
 * the courier labels with one-click print. Presentational — state and the
 * label helpers come from useCourierLabels. Extracted from ServizioCard.
 */
import type { CourierLabelItem } from "@shipment/services/labels.service";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import { useLabelZoom } from "@shared/composables/useLabelZoom";

const props = defineProps<{
  modelValue: boolean;
  tracking: string | null;
  labels: CourierLabelItem[];
  loading: boolean;
  printing: boolean;
  labelUrl: (it: CourierLabelItem, format: "pdf" | "image") => string;
  rotateDeg: (it: CourierLabelItem) => number;
  imgStyle: (it: CourierLabelItem) => Record<string, string>;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  copy: [value: string | null];
  print: [];
}>();

const { t } = useI18n();

// Track which label images have finished loading so the layout is only sized
// once naturalWidth/Height are known. Without this the <img> is measured while
// the dialog is still animating open and the image is not yet loaded
// (naturalWidth=0), so the first-time scale is wrong (worst for TNT, whose JPG
// is HTML-rendered and has no rotation fallback). Reset on reopen / new labels.
const loaded = ref(new Set<number>());
function onImgLoad(i: number): void {
  loaded.value = new Set(loaded.value).add(i);
}

const zoom = useLabelZoom();

watch(
  () => [props.modelValue, props.labels] as const,
  () => {
    loaded.value = new Set();
    // Reopening with a different label should start fit, not at the zoom the
    // previous one was left at.
    zoom.reset();
  },
);
</script>

<style scoped>
.awb-chip {
  font-family: monospace;
  font-size: 13px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  padding: 2px 8px;
  border-radius: 4px;
}
.courier-labels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.courier-zoom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.courier-zoom__level {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.courier-label {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  padding: 10px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  overflow: hidden;
  /* Center the (possibly rotated) label inside the card. */
  display: flex;
  justify-content: center;
  align-items: center;
}
/* Zoomed past "fit": let the frame scroll instead of clipping the label, so
   every corner stays reachable. The frame itself keeps its size — the dialog
   must not grow as the operator zooms. */
.courier-label--zoomed {
  overflow: auto;
  cursor: grab;
}
.courier-label__img {
  display: block;
  max-width: 100%;
  /* Fallback height cap so a not-yet-loaded / non-rotated label (TNT) stays
     contained even if it is measured before naturalWidth is known. */
  max-height: 70vh;
  height: auto;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  margin: 0 auto;
}
/* Once the image reports its real dimensions, a tiny opacity settle avoids the
   flash of a mis-sized frame during the dialog open animation. */
.courier-label__img:not(.courier-label__img--loaded) {
  opacity: 0;
}
.courier-label__img--loaded {
  opacity: 1;
  transition: opacity 0.15s ease;
}

/*
  Rotated labels (courier labels come landscape — FedEx ships 1400x950 — and
  must be shown upright).

  `transform: rotate()` is purely visual: the element keeps occupying its
  PRE-rotation box, so the 1400px-wide image still claimed 1400px of layout
  width. The card could not shrink to the upright result, `margin: auto` had
  nothing to center within, and the label spilled out mis-scaled.

  Fix: the wrapper reserves the post-rotation box via aspect-ratio (swapped
  W/H), and the image is sized against the wrapper's *height* — which, after
  the 90° turn, is what becomes the visible width. `object-fit: contain`
  guarantees the whole label stays inside its frame at any viewport size.
*/
.courier-label:has(.courier-label__img--rot90) {
  /* Upright result of a landscape label: taller than wide. */
  aspect-ratio: 950 / 1400;
  max-height: 70vh;
  /* Cap the width so the portrait frame never gets wider than the dialog. */
  width: min(100%, calc(70vh * 950 / 1400));
  margin-inline: auto;
}
.courier-label__img--rot90 {
  /* Sized in pre-rotation space: `width` here becomes the on-screen HEIGHT
     and vice versa, hence the swapped 100%/100% against the flex parent. */
  max-width: none;
  max-height: none;
  width: auto;
  height: auto;
  max-block-size: 100%;
  max-inline-size: 100%;
  object-fit: contain;
  margin: 0;
}

/* Fallback for browsers without :has() — keep the old containment so the
   label is never larger than the viewport, even if not perfectly framed. */
@supports not selector(:has(*)) {
  .courier-label__img--rot90 {
    max-height: 60vh;
    width: auto;
    margin: 8px auto;
  }
}
</style>
