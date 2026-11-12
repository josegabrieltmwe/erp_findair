<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.success_title')"
    icon="mdi-check-circle-outline"
    icon-color="success"
    size="lg"
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
    <!-- Un bulto cada vez, con anterior/siguiente, carril de bultos y descargas (PDF/ZIP) generadas en el servidor. -->
    <LabelViewer
      v-model:current="current"
      :items="viewerItems"
      :loading="loading"
      :printing="printing"
      zip-available
      :empty-title="t('shipment.awb.no_labels_title')"
      :empty-text="t('shipment.awb.no_labels_text')"
      @print="(sel) => emit('print', sel)"
      @download="(sel) => emit('download', sel)"
    />
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * "AWB generated" success dialog: shows the new tracking + the courier labels in the shared viewer (one label at
 * a time, prev/next, print and PDF/ZIP download built by the server). Presentational — state and the label
 * helpers come from useCourierLabels.
 */
import type { CourierLabelItem } from "@shipment/services/labels.service";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import LabelViewer, {
  type LabelViewerItem,
} from "@shipment/components/shipment/labels/LabelViewer.vue";
import type { LabelSelection } from "@shipment/labels/labelPackages";

const props = defineProps<{
  modelValue: boolean;
  tracking: string | null;
  labels: CourierLabelItem[];
  loading: boolean;
  printing: boolean;
  labelUrl: (it: CourierLabelItem, format: "pdf" | "image") => string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  copy: [value: string | null];
  print: [selection: LabelSelection];
  download: [selection: LabelSelection];
}>();

const { t } = useI18n();

const current = ref(0);
// Al abrir o recibir otras etiquetas se vuelve al primer bulto.
watch(
  () => [props.modelValue, props.labels] as const,
  () => {
    current.value = 0;
  },
);

const viewerItems = computed<LabelViewerItem[]>(() =>
  props.labels.map((it, k) => {
    const n = Number(it.package) || k + 1;
    return {
      key: `l${k}`,
      number: n,
      title: t("shipment.awb.label_label", { n }),
      tracking: it.package_tracking ?? it.master_tracking ?? null,
      src: props.labelUrl(it, "image"),
      loaded: true,
    };
  }),
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
</style>
