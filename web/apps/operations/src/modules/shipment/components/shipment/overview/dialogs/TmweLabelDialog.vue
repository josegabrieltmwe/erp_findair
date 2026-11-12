<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.tmwe_dialog_title')"
    icon="mdi-file-document-outline"
    size="lg"
    @close="emit('update:modelValue', false)"
  >
    <LabelViewer
      :items="items"
      :current="currentPackage - 1"
      :loading="loading && !Object.keys(cache).length"
      :loading-text="t('shipment.awb.generating_ldv')"
      :error="error"
      :item-loading="loading"
      :item-error="itemError"
      :printing="printing"
      zip-available
      :empty-title="t('shipment.awb.no_ldv_title')"
      :empty-text="t('shipment.awb.no_ldv_text')"
      @update:current="(i) => emit('go-to-package', i + 1)"
      @print="(sel) => emit('print', sel)"
      @download="(sel) => emit('download', sel)"
      @retry="emit('retry')"
    />
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Diálogo de la LDV interna (TMWE). Presentacional: el estado y las acciones viven en useTmweLabels. Los bultos
 * se piden uno a uno (la caché trae los ya cargados); el visor sabe el total aunque no estén todos.
 */
import AppDialog from "@shared/ui/AppDialog.vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import LabelViewer, {
  type LabelViewerItem,
} from "@shipment/components/shipment/labels/LabelViewer.vue";
import type { LabelSelection } from "@shipment/labels/labelPackages";
import type { TmweLabelItem } from "@shipment/services/labels.service";

const props = defineProps<{
  modelValue: boolean;
  /** Bultos ya pedidos (número → etiqueta). */
  cache: Record<number, TmweLabelItem>;
  loading: boolean;
  error: string | null;
  itemError: string | null;
  /** Bulto mostrado (1-based). */
  currentPackage: number;
  totalPackages: number;
  printing: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "go-to-package": [page: number];
  print: [selection: LabelSelection];
  download: [selection: LabelSelection];
  retry: [];
}>();

const { t } = useI18n();

const items = computed<LabelViewerItem[]>(() => {
  if (props.error) return [];
  const total = Math.max(1, props.totalPackages);
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const lab = props.cache[n];
    return {
      key: `p${n}`,
      number: n,
      title: t("shipment.awb.viewer.package_n", { n }),
      tracking: lab?.package_tracking ?? lab?.master_tracking ?? null,
      src: lab ? `data:image/${lab.format};base64,${lab.base64}` : undefined,
      loaded: !!lab,
    };
  });
});
</script>
