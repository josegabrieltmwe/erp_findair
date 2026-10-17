<template>
  <AppDialog
    :open="modelValue"
    :title="t('shipment.awb.tmwe_dialog_title')"
    icon="mdi-file-document-outline"
    size="md"
    @close="emit('update:modelValue', false)"
  >
    <div v-if="labels.length" class="d-flex align-center mb-3">
      <v-spacer />
      <v-btn
        v-if="labels.length > 1"
        variant="text"
        size="small"
        prepend-icon="mdi-folder-zip-outline"
        @click="emit('download-all')"
      >
        {{ t("shipment.awb.download_all") }}
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-printer"
        @click="emit('print')"
      >
        {{ t("shipment.awb.print") }}
      </v-btn>
    </div>
    <div v-if="loading" class="d-flex flex-column align-center pa-6">
      <v-progress-circular indeterminate size="32" />
      <div class="text-caption mt-3 text-medium-emphasis">
        {{ t("shipment.awb.generating_ldv") }}
      </div>
    </div>
    <div v-else-if="error" class="text-error pa-2">
      {{ error }}
    </div>
    <EmptyState
      v-else-if="!labels.length"
      icon="mdi-image-broken-variant"
      :title="t('shipment.awb.no_ldv_title')"
      :text="t('shipment.awb.no_ldv_text')"
    />
    <div v-else class="tmwe-labels">
      <div v-for="(lab, i) in labels" :key="i" class="tmwe-label">
        <div class="tmwe-label__header">
          <span class="text-caption text-medium-emphasis">
            {{
              t("shipment.awb.collo", {
                n: lab.package_number,
                format: lab.format.toUpperCase(),
              })
            }}
            <span v-if="lab.master_tracking" class="ms-2"
              >· {{ lab.master_tracking }}</span
            >
          </span>
          <v-spacer />
          <v-btn
            variant="tonal"
            size="x-small"
            prepend-icon="mdi-download"
            @click="emit('download', lab)"
          >
            {{ t("shipment.awb.download") }}
          </v-btn>
        </div>
        <img
          v-if="lab.format !== 'pdf'"
          :src="`data:image/${lab.format};base64,${lab.base64}`"
          alt="LDV"
          class="tmwe-label__img"
        />
        <a
          v-else
          :href="`data:application/pdf;base64,${lab.base64}`"
          target="_blank"
          rel="noopener"
          class="d-inline-flex align-center"
        >
          <v-icon
            icon="mdi-file-pdf-box"
            size="32"
            color="error"
            class="me-2"
          />
          {{ t("shipment.awb.open_pdf_collo", { n: lab.package_number }) }}
        </a>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
/**
 * Preview dialog for the internal TMWE LDV labels. Presentational — all state
 * and actions live in useTmweLabels (shared with the card header). Extracted
 * from ServizioCard unchanged.
 */
import AppDialog from "@shared/ui/AppDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import { useI18n } from "vue-i18n";
import type { TmweLabelItem } from "@shipment/services/labels.service";

defineProps<{
  modelValue: boolean;
  labels: TmweLabelItem[];
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  download: [lab: TmweLabelItem];
  "download-all": [];
  print: [];
}>();

const { t } = useI18n();
</script>

<style scoped>
.tmwe-labels {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tmwe-label {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  padding: 10px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}
.tmwe-label__header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.tmwe-label__img {
  display: block;
  max-width: 100%;
  /* Contain tall labels within the dialog viewport (base64 loads synchronously,
     so the first-time scaling bug doesn't apply here — only the height cap). */
  max-height: 70vh;
  height: auto;
  border-radius: 4px;
}
</style>
