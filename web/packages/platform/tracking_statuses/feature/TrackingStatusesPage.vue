<template>
  <div>
    <CmSectionHeader :title="t('sections.tracking_statuses')" :subtitle="t('tracking_statuses.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('tracking_statuses.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('tracking_statuses.search')"
          density="compact" hide-details clearable
          style="max-width: 320px"
          @update:model-value="onSearch"
        />
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="10"
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiMapMarkerRadius" :title="t('tracking_statuses.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ts-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:60px">{{ t('tracking_statuses.id') }}</th>
                <th style="width:90px">{{ t('tracking_statuses.tipo') }}</th>
                <th style="width:90px">{{ t('tracking_statuses.apri_giac') }}</th>
                <th>{{ t('tracking_statuses.descr_ita') }}</th>
                <th>{{ t('tracking_statuses.descr_eng') }}</th>
                <th class="text-center" style="width:100px">{{ t('tracking_statuses.stato') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td class="text-center text-medium-emphasis">{{ row.id }}</td>
                <td>
                  <v-chip size="x-small" variant="tonal" color="info">{{ tipoLabel(row.tipo) }}</v-chip>
                </td>
                <td class="text-center">
                  <v-chip size="x-small" variant="tonal" :color="row.apri_giac === 'S' ? 'warning' : 'default'">
                    {{ row.apri_giac === 'S' ? t('common.yes') : t('common.no') }}
                  </v-chip>
                </td>
                <td>{{ row.descr_ita }}</td>
                <td class="text-medium-emphasis">{{ row.descr_eng || '—' }}</td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.stato === 'A' ? 'success' : 'default'" variant="tonal">
                    {{ row.stato === 'A' ? t('tracking_statuses.stato_a') : t('tracking_statuses.stato_o') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-space-between pa-2">
            <span class="text-caption">{{ t('tracking_statuses.total', { n: page.total }) }}</span>
            <v-pagination
              v-if="page.pages > 1"
              v-model="currentPage"
              :length="page.pages"
              density="compact"
              size="small"
              @update:model-value="load"
            />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="600" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiMapMarkerRadius" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ t('tracking_statuses.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-card-text class="pt-5">
          <v-alert type="info" variant="tonal" density="compact" class="mb-4">
            {{ t('tracking_statuses.readonly_hint') }}
          </v-alert>
          <div class="cm-grid mb-3">
            <v-text-field :model-value="editRow?.id" :label="t('tracking_statuses.id')" density="compact" readonly disabled />
            <v-text-field :model-value="tipoLabel(editRow?.tipo)" :label="t('tracking_statuses.tipo')" density="compact" readonly disabled />
          </div>
          <v-text-field
            :model-value="editRow?.apri_giac === 'S' ? t('common.yes') : t('common.no')"
            :label="t('tracking_statuses.apri_giac')"
            density="compact" readonly disabled class="mb-3"
          />
          <v-text-field v-model="form.descr_ita" :label="t('tracking_statuses.descr_ita')" :rules="[requiredRule]" variant="outlined" density="comfortable" class="mb-3" />
          <v-text-field v-model="form.descr_eng" :label="t('tracking_statuses.descr_eng')" variant="outlined" density="comfortable" class="mb-3" />
          <v-text-field v-model="form.descr_spa" :label="t('tracking_statuses.descr_spa')" variant="outlined" density="comfortable" class="mb-3" />
          <v-text-field v-model="form.descr_fra" :label="t('tracking_statuses.descr_fra')" variant="outlined" density="comfortable" class="mb-3" />
          <v-textarea v-model="form.note" :label="t('tracking_statuses.note')" variant="outlined" density="comfortable" rows="2" />
        </v-card-text>

        <v-divider />
        <v-card-actions class="px-4 py-3">
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
          <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" @click="doSave">
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPencil, mdiMagnify, mdiMapMarkerRadius, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import type { Paginated } from '../../anagrafiche/services/api.types';
import {
  trackingStatusesService,
  type TrackingStatus,
} from '../services/trackingStatuses.service';

/**
 * Editor de textos de estados de tracking público (`tracking_pubblico`).
 * Réplica moderna de `track_pub.php`, pero DELIBERADAMENTE más restrictiva:
 * el legacy permite editar `tipo`/`apri_giac` libremente vía dropdowns sin
 * ninguna protección; aquí son de solo lectura (visibles para dar
 * contexto) porque alimentan Shipment_State_Machine_Service::normalize_state()
 * y `id` es número mágico hardcodeado en ~104 sitios de consumo (detección
 * de pickup vencido, caché "entregado", filtros KPI). Sin botón "nueva
 * fila": crear una fila requeriría asignarle un tipo, justo el campo que
 * no es seguro exponer sin validación cruzada con esos consumidores.
 * Ver Tracking_Pubblico_Controller (backend) — rechaza con 400/405
 * cualquier intento de tocar id/tipo/apri_giac o crear, aunque el
 * frontend intentara saltárselo.
 */

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

function emptyPage(): Paginated<TrackingStatus> {
  return { items: [], total: 0, page: 1, perPage: 20, pages: 0 };
}

const rows = ref<TrackingStatus[]>([]);
const page = ref<Paginated<TrackingStatus>>(emptyPage());
const currentPage = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const TIPO_LABELS: Record<string, string> = {
  '0': 'tracking_statuses.tipo_0',
  S: 'tracking_statuses.tipo_s',
  T: 'tracking_statuses.tipo_t',
  R: 'tracking_statuses.tipo_r',
  P: 'tracking_statuses.tipo_p',
  C: 'tracking_statuses.tipo_c',
  D: 'tracking_statuses.tipo_d',
};
function tipoLabel(tipo?: string | null): string {
  if (!tipo) return '—';
  const key = TIPO_LABELS[tipo];
  return key ? `${tipo} — ${t(key)}` : tipo;
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => load(1), 300);
}

async function load(p = currentPage.value): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    page.value = await trackingStatusesService.list(p, search.value);
    rows.value = page.value.items;
    currentPage.value = page.value.page;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const editRow = ref<TrackingStatus | null>(null);
const form = reactive({ descr_ita: '', descr_eng: '', descr_spa: '', descr_fra: '', note: '' });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function openEdit(row: TrackingStatus): void {
  editRow.value = row;
  Object.assign(form, {
    descr_ita: row.descr_ita ?? '',
    descr_eng: row.descr_eng ?? '',
    descr_spa: row.descr_spa ?? '',
    descr_fra: row.descr_fra ?? '',
    note: row.note ?? '',
  });
  dialogOpen.value = true;
}

function rowActions(row: TrackingStatus): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
  ];
}

async function doSave(): Promise<void> {
  if (!editRow.value) return;
  if (!form.descr_ita.trim()) {
    toast.error(t('common.required'));
    return;
  }
  saving.value = true;
  try {
    await trackingStatusesService.update({
      id: editRow.value.id,
      descr_ita: form.descr_ita.trim(),
      descr_eng: form.descr_eng.trim(),
      descr_spa: form.descr_spa.trim(),
      descr_fra: form.descr_fra.trim(),
      note: form.note.trim(),
    });
    toast.success(t('common.saved'));
    dialogOpen.value = false;
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(() => load(1));
</script>

<style scoped>
.ts-table :deep(th) { font-weight: 600; white-space: nowrap; }
.cm-dialog-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 12px 14px 20px;
  background: var(--cm-tone-accent-bg, #e6efff);
}
.cm-dialog-head__icon { color: var(--cm-accent, #1648b4); }
.cm-dialog-head__title {
  font-size: var(--cm-fs-md, 1rem); font-weight: var(--cm-fw-semibold, 600);
  color: var(--cm-tone-accent-text, #1648b4);
}
.cm-btn-accent { background: var(--cm-accent, #1648b4) !important; color: #fff !important; }
.ts-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ts-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ts-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
