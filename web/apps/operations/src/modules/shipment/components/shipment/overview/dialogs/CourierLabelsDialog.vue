<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.labels_dialog_title')"
    icon="mdi-truck-fast-outline"
    size="lg"
    @close="emit('update:modelValue', false)"
  >
    <LabelViewer
      v-model:current="current"
      :items="viewerItems"
      :docs="viewerDocs"
      :loading="loading"
      :error="error"
      :printing="printing"
      zip-available
      :empty-title="t('shipment.awb.no_labels_title')"
      :empty-text="t('shipment.awb.no_labels_text')"
      @print="(sel) => emit('print', sel)"
      @download="(sel) => emit('download', sel)"
      @open-doc="(d) => openDoc(d.key)"
      @download-doc="(d) => downloadDoc(d.key)"
      @retry="emit('retry')"
    />
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Diálogo de las etiquetas del fornitore (courier). Presentacional: estado y acciones en useCourierLabels.
 * Las etiquetas reales (con URL) van al visor, un bulto cada vez; los documentos auxiliares (factura comercial,
 * mercancías peligrosas…) van aparte y no cuentan como bultos.
 */
import AppDialog from "@shared/ui/AppDialog.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import LabelViewer, {
  type LabelViewerDoc,
  type LabelViewerItem,
} from "@shipment/components/shipment/labels/LabelViewer.vue";
import type { LabelSelection } from "@shipment/labels/labelPackages";
import type { CourierLabelItem } from "@shipment/services/labels.service";

const props = defineProps<{
  modelValue: boolean;
  list: CourierLabelItem[];
  loading: boolean;
  error: string | null;
  printing: boolean;
  labelUrl: (it: CourierLabelItem, format: "pdf" | "image") => string;
  title: (it: CourierLabelItem) => string;
  subtitle: (it: CourierLabelItem) => string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  print: [selection: LabelSelection];
  download: [selection: LabelSelection];
  open: [it: CourierLabelItem, format: "pdf" | "image"];
  "download-item": [it: CourierLabelItem, format: "pdf" | "image"];
  retry: [];
}>();

const { t } = useI18n();

const current = ref(0);
// Al abrir o cambiar la lista se vuelve al primer bulto.
watch(
  () => [props.modelValue, props.list] as const,
  () => {
    current.value = 0;
  },
);

/** Posición en `list` de cada elemento del visor, para devolver el original al abrir/descargar. */
const labelIdx = computed(() =>
  props.list.flatMap((it, i) => (it.is_label && it.url ? [i] : [])),
);
const docIdx = computed(() =>
  props.list.flatMap((it, i) => (!it.is_label ? [i] : [])),
);

const viewerItems = computed<LabelViewerItem[]>(() =>
  labelIdx.value.map((i, k) => {
    const it = props.list[i];
    return {
      key: `l${i}`,
      number: Number(it.package) || k + 1,
      title: props.title(it),
      tracking: it.package_tracking ?? it.master_tracking ?? null,
      src: props.labelUrl(it, "image"),
      loaded: true,
    };
  }),
);

const viewerDocs = computed<LabelViewerDoc[]>(() =>
  docIdx.value.map((i) => {
    const it = props.list[i];
    const sub = props.subtitle(it);
    return {
      key: `d${i}`,
      title: sub ? `${props.title(it)} · ${sub}` : props.title(it),
      url: it.url,
    };
  }),
);

function itemOf(key: string): CourierLabelItem | undefined {
  return props.list[Number(key.slice(1))];
}
function openDoc(key: string): void {
  const it = itemOf(key);
  if (it) emit("open", it, "pdf");
}
function downloadDoc(key: string): void {
  const it = itemOf(key);
  if (it) emit("download-item", it, "pdf");
}
</script>
