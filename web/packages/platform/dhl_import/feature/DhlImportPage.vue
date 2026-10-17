<template>
  <div>
    <CmSectionHeader :title="t('sections.dhl_import')" :subtitle="t('dhl_import.subtitle')" />

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="airports">{{ t('dhl_import.tab_airports') }}</v-tab>
      <v-tab value="priority">{{ t('dhl_import.tab_priority') }}</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <!-- Aeropuertos -->
      <v-window-item value="airports">
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
          {{ t('dhl_import.replace_warning_airports') }}
        </v-alert>

        <v-card class="pa-4 mb-4" variant="outlined" max-width="720">
          <v-file-input
            v-model="airportFile"
            :label="t('dhl_import.pick_txt_file')"
            :hint="t('dhl_import.airport_file_hint')"
            persistent-hint
            accept=".txt,text/plain"
            prepend-icon=""
            :prepend-inner-icon="mdiFileUploadOutline"
            variant="outlined"
            density="comfortable"
            show-size
            clearable
          />

          <v-card-actions class="px-0 pt-3">
            <v-spacer />
            <v-btn
              class="cm-btn-accent"
              variant="flat"
              :prepend-icon="mdiUpload"
              :loading="importingAirports"
              :disabled="!airportFile"
              @click="doImportAirports"
            >
              {{ t('dhl_import.import') }}
            </v-btn>
          </v-card-actions>
        </v-card>

        <ImportResultCard v-if="airportResult" :report="airportResult" :t="t" />
      </v-window-item>

      <!-- Prioritarios -->
      <v-window-item value="priority">
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
          {{ t('dhl_import.replace_warning_priority') }}
        </v-alert>

        <v-card class="pa-4 mb-4" variant="outlined" max-width="720">
          <v-file-input
            v-model="priorityFile"
            :label="t('dhl_import.pick_txt_file')"
            accept=".txt,text/plain"
            prepend-icon=""
            :prepend-inner-icon="mdiFileUploadOutline"
            variant="outlined"
            density="comfortable"
            show-size
            clearable
            @update:model-value="onPriorityFileChange"
          />

          <template v-if="priorityPreview">
            <div class="di-preview-label">{{ t('dhl_import.preview', { n: priorityPreviewCount }) }}</div>
            <pre class="di-preview">{{ priorityPreview }}</pre>
          </template>

          <v-card-actions class="px-0 pt-3">
            <v-spacer />
            <v-btn
              class="cm-btn-accent"
              variant="flat"
              :prepend-icon="mdiUpload"
              :loading="importingPriority"
              :disabled="!priorityContent"
              @click="doImportPriority"
            >
              {{ t('dhl_import.import') }}
            </v-btn>
          </v-card-actions>
        </v-card>

        <ImportResultCard v-if="priorityResult" :report="priorityResult" :t="t" />
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiFileUploadOutline, mdiUpload } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { dhlImportService, type ImportReport } from '../services/dhlImport.service';
import ImportResultCard from './ImportResultCard.vue';

const { t } = useI18n();
const toast = useToastStore();

const tab = ref('airports');

// Aeropuertos: archivo puede ser enorme (~1.6M filas) — se sube tal cual,
// sin leerlo en el navegador (evita cargar decenas de MB en memoria del
// cliente solo para una vista previa).
const airportFile = ref<File | null>(null);
const importingAirports = ref(false);
const airportResult = ref<ImportReport | null>(null);

async function doImportAirports() {
  if (!airportFile.value) return;
  importingAirports.value = true;
  airportResult.value = null;
  try {
    airportResult.value = await dhlImportService.importAirports(airportFile.value);
    if (airportResult.value.failed === 0) {
      toast.success(t('dhl_import.result_success', { n: airportResult.value.imported }));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    importingAirports.value = false;
  }
}

// Prioritarios: archivo pequeño (~62k filas) — sí se lee en el navegador
// para poder mostrar una vista previa, igual que Freschi.
const priorityFile = ref<File | null>(null);
const priorityContent = ref('');
const importingPriority = ref(false);
const priorityResult = ref<ImportReport | null>(null);

const priorityPreview = computed(() => {
  if (!priorityContent.value) return '';
  const lines = priorityContent.value.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  return lines.slice(0, 10).join('\n');
});
const priorityPreviewCount = computed(
  () => priorityContent.value.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length,
);

function onPriorityFileChange(f: File | File[] | null) {
  priorityResult.value = null;
  const picked = Array.isArray(f) ? f[0] : f;
  if (!picked) {
    priorityContent.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    priorityContent.value = typeof reader.result === 'string' ? reader.result : '';
  };
  reader.readAsText(picked);
}

async function doImportPriority() {
  if (!priorityContent.value) return;
  importingPriority.value = true;
  priorityResult.value = null;
  try {
    priorityResult.value = await dhlImportService.importPriorityServices(priorityContent.value);
    if (priorityResult.value.failed === 0) {
      toast.success(t('dhl_import.result_success', { n: priorityResult.value.imported }));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    importingPriority.value = false;
  }
}
</script>

<style scoped>
.di-preview-label {
  font-size: var(--cm-fs-sm, 0.8125rem);
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 8px;
}
.di-preview {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: var(--cm-fs-sm, 0.8125rem);
  max-height: 220px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.cm-btn-accent { background: var(--cm-accent, #1648b4) !important; color: #fff !important; }
</style>
