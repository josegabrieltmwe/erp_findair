<template>
  <div>
    <CmSectionHeader
      :title="t('sections.b2b')"
      :subtitle="t('b2b.subtitle')"
    />

    <CmAsyncSection :error="error" :loading="false" @clear-error="error = null">
      <div class="cm-search-row">
        <CmAnagraficaAutocomplete
          v-model="idAnagrafica"
          :label="t('b2b.search_partner')"
          class="cm-search-autocomplete"
          @select="onPartnerSelect"
        />
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!idAnagrafica"
          :prepend-icon="mdiMagnify"
          @click="loadConfig"
        >
          {{ t('b2b.load') }}
        </v-btn>
      </div>
    </CmAsyncSection>

    <CmAsyncSection
      :loading="loading"
      :error="null"
      :empty="!loading && !config && hasSearched"
      :data="config"
    >
      <template #empty>
        <CmEmptyState :icon="mdiDomain" :title="t('b2b.empty_title')">
          <p>{{ t('b2b.empty_message', { partner: selectedPartnerLabel }) }}</p>
        </CmEmptyState>
      </template>

      <template #default>
        <v-card class="pa-4 mt-2">
          <div v-if="companyName" class="cm-company">
            {{ t('b2b.config_for') }} <strong>#{{ idAnagrafica }}</strong> — {{ companyName }}
          </div>

          <div class="cm-grid">
            <template v-for="field in editableFields" :key="field">
              <v-switch
                v-if="fieldType(field) === 'boolean'"
                v-model="editData[field]"
                :label="field"
                :true-value="1"
                :false-value="0"
                color="primary"
              />
              <v-text-field
                v-else
                v-model="editData[field]"
                :label="field"
                :type="fieldType(field) === 'number' ? 'number' : 'text'"
              />
            </template>
          </div>

          <div class="cm-actions">
            <v-btn variant="text" @click="resetForm">{{ t('common.cancel') }}</v-btn>
            <v-btn color="primary" :loading="saving" :prepend-icon="mdiContentSave" @click="saveConfig">
              {{ t('common.save') }}
            </v-btn>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiMagnify, mdiDomain, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import type { AnagraficaLite } from '../../anagrafiche/services/anagrafica.service';
import { b2bService, type B2bConfig } from '../services/b2b.service';
import { useToast } from '../../anagrafiche/composables/useToast';

const { t } = useI18n();
const toast = useToast();

const idAnagrafica = ref<number | null>(null);
const selectedPartner = ref<AnagraficaLite | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const config = ref<B2bConfig | null>(null);
const editData = ref<B2bConfig>({});
const hasSearched = ref(false);

const selectedPartnerLabel = computed(() =>
  selectedPartner.value
    ? `#${selectedPartner.value.id} — ${selectedPartner.value.rag_soc}`
    : `#${idAnagrafica.value ?? '—'}`,
);

function onPartnerSelect(opt: AnagraficaLite | null): void {
  selectedPartner.value = opt;
  // Si el usuario cambia de partner, limpiar la config previa.
  config.value = null;
  hasSearched.value = false;
  error.value = null;
}

const SKIP_FIELDS = new Set([
  'id',
  'id_anagrafica',
  'stato',
  'created_at',
  'updated_at',
  'deleted_at',
  'ragione_sociale',
  'nome',
]);

const editableFields = computed(() => (config.value ? Object.keys(config.value).filter((k) => !SKIP_FIELDS.has(k)) : []));

const companyName = computed(
  () =>
    (config.value?.ragione_sociale as string | undefined)
      ?? selectedPartner.value?.rag_soc
      ?? '',
);

function fieldType(key: string): 'boolean' | 'number' | 'text' {
  if (!config.value) return 'text';
  const v = config.value[key];
  if (typeof v === 'boolean') return 'boolean';
  if (v === 0 || v === 1 || v === '0' || v === '1') return 'boolean';
  if (typeof v === 'number') return 'number';
  return 'text';
}

async function loadConfig(): Promise<void> {
  if (!idAnagrafica.value || idAnagrafica.value <= 0) {
    error.value = t('b2b.validation_partner_required');
    return;
  }
  loading.value = true;
  error.value = null;
  config.value = null;
  hasSearched.value = true;
  try {
    const data = await b2bService.get(idAnagrafica.value);
    config.value = data;
    editData.value = JSON.parse(JSON.stringify(data));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function saveConfig(): Promise<void> {
  if (!idAnagrafica.value || !config.value) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = await b2bService.update(idAnagrafica.value, editData.value);
    config.value = updated || editData.value;
    editData.value = JSON.parse(JSON.stringify(config.value));
    toast.success(t('b2b.saved'));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

function resetForm(): void {
  if (config.value) editData.value = JSON.parse(JSON.stringify(config.value));
}
</script>

<style scoped>
.cm-search-row {
  display: flex;
  align-items: center;
  gap: var(--cm-space-md);
  margin-bottom: var(--cm-space-md);
}
.cm-search-autocomplete {
  min-width: 320px;
  max-width: 480px;
  flex: 1 1 auto;
}
.cm-company {
  font-size: var(--cm-fs-sm);
  color: var(--cm-text-secondary);
  margin-bottom: var(--cm-space-md);
}
@media (max-width: 600px) {
  .cm-grid {
    grid-template-columns: 1fr;
  }
}
/* page-utils provides .cm-actions globally; this override aligns to right */
.cm-actions {
  justify-content: flex-end;
  margin-top: var(--cm-space-lg);
}
</style>
