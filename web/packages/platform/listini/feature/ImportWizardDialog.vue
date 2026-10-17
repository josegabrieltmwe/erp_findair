<template>
  <v-dialog :model-value="modelValue" max-width="720" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiFileUpload" class="mr-2" />
        {{ t('price_lists.import_title') }}
      </v-card-title>

      <v-card-text>
        <v-stepper v-model="step" flat :items="stepLabels" hide-actions>
          <!-- ── Step 1: upload ── -->
          <template #[`item.1`]>
            <div class="py-2">
              <v-select
                v-model="format"
                :items="formatItems"
                :label="t('price_lists.import_format')"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-4"
              />
              <v-file-input
                v-model="file"
                :label="t('price_lists.import_file')"
                :accept="acceptTypes"
                density="compact"
                variant="outlined"
                :prepend-icon="mdiPaperclip"
                show-size
                hide-details
              />
              <p class="text-caption text-medium-emphasis mt-3">
                {{ t('price_lists.import_hint') }}
              </p>
            </div>
          </template>

          <!-- ── Step 2: preview ── -->
          <template #[`item.2`]>
            <div v-if="preview" class="py-2">
              <div class="d-flex ga-4 mb-4 flex-wrap">
                <v-chip color="success" variant="tonal" :prepend-icon="mdiCheckCircle">
                  {{ t('price_lists.import_valid_rows', { n: preview.valid_rows }) }}
                </v-chip>
                <v-chip
                  v-if="preview.error_rows > 0"
                  color="error"
                  variant="tonal"
                  :prepend-icon="mdiAlertCircle"
                >
                  {{ t('price_lists.import_error_rows', { n: preview.error_rows }) }}
                </v-chip>
                <v-chip v-if="preview.new_zones.length > 0" color="warning" variant="tonal">
                  {{ t('price_lists.import_new_zones', { z: preview.new_zones.join(', ') }) }}
                </v-chip>
              </div>

              <v-alert
                v-if="preview.valid_rows === 0"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{ t('price_lists.import_no_valid') }}
              </v-alert>

              <div v-if="preview.errors.length > 0" class="mb-4">
                <p class="text-subtitle-2 mb-1">{{ t('price_lists.import_errors_title') }}</p>
                <div class="cm-import-errors">
                  <pre class="text-caption">{{ formatErrors(preview.errors) }}</pre>
                </div>
              </div>

              <v-radio-group v-model="mode" inline hide-details density="compact" class="mt-2">
                <template #label>
                  <span class="text-subtitle-2">{{ t('price_lists.import_mode') }}</span>
                </template>
                <v-radio :label="t('price_lists.import_mode_merge')" value="merge" />
                <v-radio :label="t('price_lists.import_mode_replace')" value="replace" />
              </v-radio-group>
              <p class="text-caption text-medium-emphasis mt-1">
                {{ mode === 'replace' ? t('price_lists.import_mode_replace_hint') : t('price_lists.import_mode_merge_hint') }}
              </p>
              <v-radio-group v-if="format === 'supplements'" v-model="supplMode" inline hide-details density="compact" class="mt-2">
                <template #label>
                  <span class="text-subtitle-2">{{ t('price_lists.import_suppl_mode') }}</span>
                </template>
                <v-radio :label="t('price_lists.suppl_mode_new')" value="NEW" />
                <v-radio :label="t('price_lists.suppl_mode_act')" value="ACT" />
              </v-radio-group>
              <v-alert type="info" variant="tonal" density="compact" class="mt-3">
                {{ t('price_lists.import_version_note') }}
              </v-alert>
            </div>
          </template>

          <!-- ── Step 3: result ── -->
          <template #[`item.3`]>
            <div v-if="result" class="py-4 text-center">
              <v-icon :icon="mdiCheckCircle" color="success" size="48" class="mb-2" />
              <p class="text-h6 mb-1">{{ t('price_lists.import_done') }}</p>
              <p class="text-body-2 text-medium-emphasis">
                {{ t('price_lists.import_result', {
                  ins: result.inserted,
                  upd: result.updated,
                  del: result.deleted,
                }) }}
              </p>
            </div>
          </template>
        </v-stepper>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="busy" @click="onClose(false)">
          {{ step === 3 ? t('common.close') : t('common.cancel') }}
        </v-btn>
        <v-btn
          v-if="step === 1"
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!file"
          @click="doPreview"
        >
          {{ t('price_lists.import_preview_btn') }}
        </v-btn>
        <v-btn
          v-else-if="step === 2"
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!preview || preview.valid_rows === 0"
          @click="doConfirm"
        >
          {{ t('price_lists.import_confirm_btn') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiFileUpload,
  mdiPaperclip,
  mdiCheckCircle,
  mdiAlertCircle,
} from '@mdi/js';
import {
  listiniService,
  type ImportPreview,
  type ImportResult,
  type ImportMode,
} from '../services/listini.service';

const props = defineProps<{ modelValue: boolean; packId: number | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'imported', result: ImportResult): void;
}>();

const { t } = useI18n();

const step = ref(1);
const format = ref('express');
const file = ref<File | null>(null);
const mode = ref<ImportMode>('merge');
const supplMode = ref<'ACT' | 'NEW'>('NEW');
const preview = ref<ImportPreview | null>(null);
const result = ref<ImportResult | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const stepLabels = computed(() => [
  { title: t('price_lists.import_step_upload'), value: 1 },
  { title: t('price_lists.import_step_preview'), value: 2 },
  { title: t('price_lists.import_step_done'), value: 3 },
]);

const formatItems = computed(() => [
  { title: t('price_lists.import_format_express'), value: 'express' },
  { title: t('price_lists.import_format_supplements'), value: 'supplements' },
]);

const acceptTypes = '.csv,.xlsx,.xls,.tsv';

function reset(): void {
  step.value = 1;
  file.value = null;
  mode.value = 'merge';
  supplMode.value = 'NEW';
  preview.value = null;
  result.value = null;
  error.value = null;
  busy.value = false;
}

watch(() => props.modelValue, (open) => {
  if (open) reset();
});

function formatErrors(errors: Array<Record<string, unknown>>): string {
  return errors
    .slice(0, 50)
    .map((e) => JSON.stringify(e))
    .join('\n');
}

// v-file-input may yield File | File[] depending on Vuetify version/multiple flag.
function pickFile(): File | null {
  const f = file.value as unknown;
  if (!f) return null;
  if (Array.isArray(f)) return (f[0] as File) ?? null;
  return f as File;
}

async function doPreview(): Promise<void> {
  const f = pickFile();
  if (!f || !props.packId) return;
  busy.value = true;
  error.value = null;
  try {
    preview.value = await listiniService.importPreview(props.packId, f, format.value);
    step.value = 2;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function doConfirm(): Promise<void> {
  if (!preview.value || !props.packId) return;
  busy.value = true;
  error.value = null;
  try {
    const res = await listiniService.importConfirm(
      props.packId,
      preview.value.valid_rows_data,
      mode.value,
      format.value,
      supplMode.value,
    );
    result.value = res;
    step.value = 3;
    emit('imported', res);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function onClose(v: boolean): void {
  if (busy.value) return;
  emit('update:modelValue', v === true ? true : false);
}
</script>

<style scoped>
.cm-import-errors {
  max-height: 160px;
  overflow: auto;
  background: var(--cm-surface-alt, #fafafa);
  border: 1px solid var(--cm-border-light, #f0f0f0);
  border-radius: 6px;
  padding: 8px;
}
.cm-import-errors pre {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
