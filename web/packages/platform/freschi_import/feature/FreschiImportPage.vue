<template>
  <div>
    <CmSectionHeader :title="t('sections.freschi_import')" :subtitle="t('freschi_import.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('freschi_import.replace_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined" max-width="720">
      <v-file-input
        v-model="file"
        :label="t('freschi_import.pick_file')"
        accept=".txt,text/plain"
        prepend-icon=""
        :prepend-inner-icon="mdiFileUploadOutline"
        variant="outlined"
        density="comfortable"
        show-size
        clearable
        @update:model-value="onFileChange"
      />

      <template v-if="preview">
        <div class="fi-preview-label">{{ t('freschi_import.preview', { n: previewLineCount }) }}</div>
        <pre class="fi-preview">{{ preview }}</pre>
      </template>

      <v-card-actions class="px-0 pt-3">
        <v-spacer />
        <v-btn
          class="cm-btn-accent"
          variant="flat"
          :prepend-icon="mdiUpload"
          :loading="importing"
          :disabled="!content"
          @click="doImport"
        >
          {{ t('freschi_import.import') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-if="result" variant="outlined" max-width="720">
      <div class="pa-4">
        <div class="d-flex align-center mb-3">
          <v-icon
            :icon="result.report.failed > 0 ? mdiAlertCircleOutline : mdiCheckCircleOutline"
            :color="result.report.failed > 0 ? 'error' : 'success'"
            size="24"
            class="mr-2"
          />
          <span class="text-subtitle-1">
            {{ result.report.failed > 0
              ? t('freschi_import.result_failed', { n: result.report.failed })
              : t('freschi_import.result_success', { n: result.report.imported }) }}
          </span>
        </div>

        <v-table v-if="result.report.errors.length" density="compact">
          <thead>
            <tr>
              <th style="width:70px">{{ t('freschi_import.row') }}</th>
              <th>{{ t('freschi_import.error_message') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(err, i) in result.report.errors" :key="i">
              <td>{{ err.row }}</td>
              <td>
                {{ err.message }}
                <div v-if="err.line" class="fi-error-line">{{ err.line }}</div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiFileUploadOutline, mdiUpload, mdiCheckCircleOutline, mdiAlertCircleOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { freschiImportService, type FreschiImportResult } from '../services/freschiImport.service';

const { t } = useI18n();
const toast = useToastStore();

const file = ref<File | null>(null);
const content = ref('');
const importing = ref(false);
const result = ref<FreschiImportResult | null>(null);

const preview = computed(() => {
  if (!content.value) return '';
  const lines = content.value.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  return lines.slice(0, 10).join('\n');
});
const previewLineCount = computed(
  () => content.value.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').length,
);

function onFileChange(f: File | File[] | null) {
  result.value = null;
  const picked = Array.isArray(f) ? f[0] : f;
  if (!picked) {
    content.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    content.value = typeof reader.result === 'string' ? reader.result : '';
  };
  reader.readAsText(picked);
}

async function doImport() {
  if (!content.value) return;
  importing.value = true;
  result.value = null;
  try {
    result.value = await freschiImportService.import(content.value, 'IT');
    if (result.value.report.failed === 0) {
      toast.success(t('freschi_import.result_success', { n: result.value.report.imported }));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.fi-preview-label {
  font-size: var(--cm-fs-sm, 0.8125rem);
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 8px;
}
.fi-preview {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
  padding: 10px 12px;
  font-size: var(--cm-fs-sm, 0.8125rem);
  max-height: 220px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.fi-error-line {
  font-size: var(--cm-fs-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-family: monospace;
}
.cm-btn-accent { background: var(--cm-accent, #1648b4) !important; color: #fff !important; }
</style>
