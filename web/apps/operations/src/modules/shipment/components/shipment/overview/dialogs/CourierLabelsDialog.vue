<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.labels_dialog_title')"
    icon="mdi-truck-fast-outline"
    size="md"
    @close="emit('update:modelValue', false)"
  >
    <div v-if="items.length" class="d-flex justify-end ga-1 mb-3">
      <v-btn
        v-if="items.length > 1"
        variant="text"
        size="small"
        prepend-icon="mdi-folder-download-outline"
        @click="emit('download-all')"
      >
        {{ t("shipment.awb.download_all") }}
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-printer"
        :loading="printing"
        @click="emit('print')"
      >
        {{ t("shipment.awb.print") }}
      </v-btn>
    </div>
    <div v-if="loading" class="d-flex justify-center pa-4">
      <v-progress-circular indeterminate size="28" />
    </div>
    <div v-else-if="error" class="text-error pa-2">
      {{ error }}
    </div>
    <EmptyState
      v-else-if="!list.length"
      icon="mdi-package-variant-closed-remove"
      :title="t('shipment.awb.no_labels_title')"
      :text="t('shipment.awb.no_labels_text')"
    />
    <div v-else class="courier-labels">
      <div
        v-for="(it, i) in list"
        :key="i"
        class="courier-label"
        :class="{ 'courier-label--aux': !it.is_label }"
      >
        <div class="courier-label__header">
          <v-icon
            :icon="it.is_label ? 'mdi-barcode' : 'mdi-file-document-outline'"
            size="16"
            class="me-1"
          />
          <span class="text-caption">
            <strong>{{ title(it) }}</strong>
            <span v-if="subtitle(it)" class="text-medium-emphasis ms-1">
              · {{ subtitle(it) }}
            </span>
          </span>
          <v-spacer />
          <!-- Zoom applies to the inline previews (real labels only). -->
          <div v-if="it.url && it.is_label" class="d-flex align-center me-2">
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
          <div v-if="it.url" class="d-flex ga-1">
            <!-- ajax_get_label_file converts on the fly via ?format=. -->
            <v-btn
              variant="tonal"
              size="x-small"
              prepend-icon="mdi-file-pdf-box"
              :title="t('shipment.awb.open_pdf')"
              @click="emit('open', it, 'pdf')"
            >
              {{ t("shipment.awb.pdf") }}
            </v-btn>
            <v-btn
              variant="tonal"
              size="x-small"
              prepend-icon="mdi-image-outline"
              :title="t('shipment.awb.open_image')"
              @click="emit('open', it, 'image')"
            >
              {{ t("shipment.awb.img") }}
            </v-btn>
            <v-btn
              icon="mdi-download"
              variant="text"
              size="x-small"
              :title="t('shipment.awb.download_pdf')"
              @click="emit('download', it, 'pdf')"
            />
          </div>
        </div>
        <!-- Inline preview: real labels render as image; auxiliary docs keep
             a PDF link (they are usually multi-page documents). -->
        <div
          v-if="it.url && it.is_label"
          class="courier-label__frame"
          :class="{ 'courier-label__frame--zoomed': !zoom.isFit.value }"
          @wheel="zoom.onWheel"
        >
          <img
            :src="labelUrl(it, 'image')"
            alt="label"
            class="courier-label__img"
            :class="{ 'courier-label__img--loaded': loaded.has(i) }"
            :style="zoom.styleFor()"
            @load="onImgLoad(i)"
          />
        </div>
        <a
          v-else-if="it.url"
          :href="labelUrl(it, 'pdf')"
          target="_blank"
          rel="noopener"
          class="d-inline-flex align-center pa-2"
        >
          <v-icon
            icon="mdi-file-pdf-box"
            size="28"
            color="error"
            class="me-2"
          />
          {{ t("shipment.awb.open_pdf") }}
        </a>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Full courier-labels dialog: inline image preview + per-label open/download and
 * print/download-all header actions. Presentational — state and helpers come
 * from useCourierLabels. Extracted from ServizioCard unchanged.
 */
import AppDialog from "@shared/ui/AppDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import { useLabelZoom } from "@shared/composables/useLabelZoom";
import type { CourierLabelItem } from "@shipment/services/labels.service";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  modelValue: boolean;
  list: CourierLabelItem[];
  items: CourierLabelItem[];
  loading: boolean;
  error: string | null;
  printing: boolean;
  labelUrl: (it: CourierLabelItem, format: "pdf" | "image") => string;
  title: (it: CourierLabelItem) => string;
  subtitle: (it: CourierLabelItem) => string;
}>();

// Only size each label image once it has loaded (naturalWidth known), so it
// doesn't get mis-scaled while the dialog opens with the image not yet loaded.
const loaded = ref(new Set<number>());
function onImgLoad(i: number): void {
  loaded.value = new Set(loaded.value).add(i);
}

const zoom = useLabelZoom();

watch(
  () => [props.modelValue, props.list] as const,
  () => {
    loaded.value = new Set();
    zoom.reset();
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  print: [];
  "download-all": [];
  open: [it: CourierLabelItem, format: "pdf" | "image"];
  download: [it: CourierLabelItem, format: "pdf" | "image"];
}>();

const { t } = useI18n();
</script>

<style scoped>
.courier-labels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.courier-label {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  padding: 10px;
  background: rgba(var(--v-theme-on-surface), 0.02);
  overflow: hidden;
}
.courier-label--aux {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.courier-label__header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.courier-zoom__level {
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
/* Frame around the preview: fixed box that scrolls once the label is zoomed
   past "fit", so magnifying never grows the dialog. */
.courier-label__frame {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.courier-label__frame--zoomed {
  overflow: auto;
  max-height: 70vh;
  cursor: grab;
}
.courier-label__img {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  height: auto;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  /* Center a label narrower than the card instead of pinning it left. */
  margin-inline: auto;
}
.courier-label__img:not(.courier-label__img--loaded) {
  opacity: 0;
}
.courier-label__img--loaded {
  opacity: 1;
  transition: opacity 0.15s ease;
}
</style>
