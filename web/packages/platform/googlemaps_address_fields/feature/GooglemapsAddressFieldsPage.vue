<template>
  <div>
    <CmSectionHeader :title="t('sections.googlemaps_address_fields')" :subtitle="t('googlemaps_address_fields.subtitle')" />

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('googlemaps_address_fields.scope_note') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <v-text-field
        v-model="search"
        :prepend-inner-icon="mdiMagnify"
        :label="t('googlemaps_address_fields.search')"
        density="compact" hide-details clearable
        style="max-width: 300px"
      />
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="3"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiMapMarkerOutline" :title="t('googlemaps_address_fields.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ga-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('googlemaps_address_fields.country') }}</th>
                <th style="width:260px">{{ t('googlemaps_address_fields.province_selector') }}</th>
                <th style="width:260px">{{ t('googlemaps_address_fields.city_selector') }}</th>
                <th class="text-center" style="width:90px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.name }}</b> <span class="ga-iso">({{ row.iso }})</span></td>
                <td>
                  <v-select
                    :model-value="draft[row.id]?.province_selector ?? null"
                    :items="selectorItems"
                    :placeholder="t('googlemaps_address_fields.not_configured')"
                    density="compact" hide-details variant="outlined" clearable
                    @update:model-value="(v) => setDraft(row, 'province_selector', v)"
                  />
                </td>
                <td>
                  <v-select
                    :model-value="draft[row.id]?.city_selector ?? null"
                    :items="selectorItems"
                    :placeholder="t('googlemaps_address_fields.not_configured')"
                    density="compact" hide-details variant="outlined" clearable
                    @update:model-value="(v) => setDraft(row, 'city_selector', v)"
                  />
                </td>
                <td class="text-center">
                  <v-btn
                    :icon="mdiContentSave" size="small" variant="tonal" color="primary"
                    :disabled="!isDirty(row)"
                    :loading="saving === row.id"
                    :title="t('common.save')"
                    @click="saveRow(row)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('googlemaps_address_fields.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiMagnify, mdiMapMarkerOutline, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import {
  googlemapsAddressFieldsService, type AddressFieldMapping,
} from '../services/googlemapsAddressFields.service';

const { t } = useI18n();
const toast = useToastStore();

const rows = ref<AddressFieldMapping[]>([]);
const validSelectors = ref<string[]>([]);
const search = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref<number | null>(null);

const selectorItems = computed(() => validSelectors.value);

interface DraftRow {
  province_selector: string | null;
  city_selector: string | null;
}
const draft = reactive<Record<number, DraftRow>>({});

function seedDraft() {
  for (const r of rows.value) {
    draft[r.id] = { province_selector: r.province_selector, city_selector: r.city_selector };
  }
}

function setDraft(row: AddressFieldMapping, field: keyof DraftRow, value: string | null) {
  if (!draft[row.id]) draft[row.id] = { province_selector: row.province_selector, city_selector: row.city_selector };
  draft[row.id][field] = value;
}

function isDirty(row: AddressFieldMapping): boolean {
  const d = draft[row.id];
  if (!d) return false;
  return d.province_selector !== row.province_selector || d.city_selector !== row.city_selector;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) => r.name.toLowerCase().includes(q) || r.iso.toLowerCase().includes(q));
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const result = await googlemapsAddressFieldsService.list();
    rows.value = result.items;
    validSelectors.value = result.validSelectors;
    seedDraft();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveRow(row: AddressFieldMapping) {
  const d = draft[row.id];
  if (!d) return;
  saving.value = row.id;
  try {
    await googlemapsAddressFieldsService.save({
      id_country: row.id,
      province_selector: d.province_selector,
      city_selector: d.city_selector,
    });
    row.province_selector = d.province_selector;
    row.city_selector = d.city_selector;
    toast.success(t('common.saved'));
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.ga-table :deep(th) { font-weight: 600; white-space: nowrap; }
.ga-iso { color: rgba(var(--v-theme-on-surface), 0.55); font-size: var(--cm-fs-sm, 0.8125rem); }
.ga-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ga-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ga-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
