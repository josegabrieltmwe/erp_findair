<template>
  <div>
    <CmSectionHeader
      :title="t('sections.supplier_tracking_codes')"
      :subtitle="t('supplier_tracking_codes.subtitle')"
    />

    <!-- Selector de fornitore (obligatorio para cargar) -->
    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <CmAnagraficaAutocomplete
          v-model="idFornitore"
          :label="t('supplier_tracking_codes.fornitore')"
          :initial-option="fornitoreOption"
          style="min-width:320px; max-width:460px"
          @select="onFornitoreSelect"
        />
        <v-spacer />
        <v-btn
          v-if="idFornitore"
          class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus"
          @click="openCreate"
        >
          {{ tab === 'mapped' ? t('supplier_tracking_codes.new_mapped') : t('supplier_tracking_codes.new_unmapped') }}
        </v-btn>
      </div>
    </v-card>

    <div v-if="!idFornitore" class="text-center pa-8 text-medium-emphasis">
      <v-icon :icon="mdiTruckOutline" size="48" class="mb-2 d-block mx-auto" />
      {{ t('supplier_tracking_codes.pick_fornitore') }}
    </div>

    <template v-else>
      <v-tabs v-model="tab" class="mb-2" color="primary">
        <v-tab value="mapped">
          {{ t('supplier_tracking_codes.tab_mapped') }}
          <v-chip size="x-small" class="ms-2" variant="flat">{{ mapped.length }}</v-chip>
        </v-tab>
        <v-tab value="unmapped">
          {{ t('supplier_tracking_codes.tab_unmapped') }}
          <v-chip size="x-small" class="ms-2" variant="flat" :color="unmapped.length ? 'warning' : undefined">{{ unmapped.length }}</v-chip>
        </v-tab>
      </v-tabs>

      <!-- Tab: mapeados -->
      <template v-if="tab === 'mapped'">
        <CmEmptyState v-if="!loading && !error && mapped.length === 0" :icon="mdiMapMarkerPath" :title="t('supplier_tracking_codes.empty_mapped')" />
        <ListingDataView
          v-else
          :source="mappedListSource"
          :headers="mappedHeaders"
          :selected="selectedMapped"
          :sort-key-map="mappedSortKeyMap"
          mode="infinite"
          :selectable="false"
          @update:selected="selectedMapped = $event"
        >
          <template #cell.descr_forn="{ item }">
            <span class="cm-mono"><b>{{ (item as TrackingCode).descr_forn }}</b></span>
          </template>
          <template #cell.pub_descr="{ item }">
            {{ (item as TrackingCode).pub_descr || ('#' + (item as TrackingCode).id_tracking_pubblico) }}
          </template>
          <template #cell.pub_tipo="{ item }">
            <v-chip size="x-small" variant="tonal">{{ (item as TrackingCode).pub_tipo || '—' }}</v-chip>
          </template>
          <template #cell.pub_apri_giac="{ item }">
            <v-icon
              :icon="(item as TrackingCode).pub_apri_giac === 'S' ? mdiCheckCircle : mdiMinusCircleOutline"
              :color="(item as TrackingCode).pub_apri_giac === 'S' ? 'warning' : 'grey'"
              size="small"
            />
          </template>
          <template #cell.note="{ item }">
            <span class="text-truncate d-inline-block" style="max-width:260px">{{ (item as TrackingCode).note }}</span>
          </template>
          <template #cell.actions="{ item }">
            <CmRowActions :actions="mappedRowActions(item as TrackingCode)" />
          </template>
        </ListingDataView>
      </template>

      <!-- Tab: no mapeados -->
      <template v-else>
        <CmEmptyState v-if="!loading && !error && unmapped.length === 0" :icon="mdiCheckAll" :title="t('supplier_tracking_codes.empty_unmapped')" />
        <ListingDataView
          v-else
          :source="unmappedListSource"
          :headers="unmappedHeaders"
          :selected="selectedUnmapped"
          :sort-key-map="unmappedSortKeyMap"
          mode="infinite"
          :selectable="false"
          @update:selected="selectedUnmapped = $event"
        >
          <template #cell.descr_forn="{ item }">
            <span class="cm-mono"><b>{{ (item as UnmappedCode).descr_forn }}</b></span>
          </template>
          <template #cell.contatore="{ item }">
            {{ (item as UnmappedCode).contatore ?? '—' }}
          </template>
          <template #cell.ai_suggestion="{ item }">
            <span v-if="(item as UnmappedCode).ai_suggested_id_pubblico" class="d-flex align-center" style="gap:6px">
              <v-chip size="x-small" variant="tonal" :color="aiColor((item as UnmappedCode).ai_review_status)">
                {{ (item as UnmappedCode).ai_review_status || 'AI' }}
              </v-chip>
              <span class="text-caption">{{ statusLabel((item as UnmappedCode).ai_suggested_id_pubblico) }}</span>
            </span>
            <span v-else class="text-medium-emphasis text-caption">—</span>
          </template>
          <template #cell.note="{ item }">
            <span class="text-truncate d-inline-block" style="max-width:220px">{{ (item as UnmappedCode).note }}</span>
          </template>
          <template #cell.actions="{ item }">
            <v-btn size="x-small" variant="tonal" color="primary" class="me-1" :prepend-icon="mdiArrowRightBold" @click="promote(item as UnmappedCode)">
              {{ t('supplier_tracking_codes.promote') }}
            </v-btn>
            <v-icon :icon="mdiDelete" color="error" size="small" style="cursor:pointer" @click="removeUnmapped(item as UnmappedCode)" />
          </template>
        </ListingDataView>
      </template>
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2" closable @click:close="error = null">
        {{ error }}
      </v-alert>
    </template>

    <!-- Dialog: mapeado (crear/editar) -->
    <v-dialog v-model="mappedDialog" max-width="620" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiMapMarkerPath" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editMappedId === null ? t('supplier_tracking_codes.new_mapped') : t('supplier_tracking_codes.edit_mapped') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="mappedDialog = false" />
        </div>
        <v-divider />
        <v-form ref="mappedFormRef" @submit.prevent="saveMapped">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="mForm.descr_forn"
                  :label="t('supplier_tracking_codes.code')" :rules="[requiredRule]"
                  :hint="t('supplier_tracking_codes.code_hint')" persistent-hint
                  variant="outlined" density="comfortable" :prepend-inner-icon="mdiBarcode" autofocus
                />
              </v-col>
              <v-col cols="12" sm="7">
                <v-autocomplete
                  v-model="mForm.id_tracking_pubblico"
                  :items="publicStatuses" :item-title="statusTitle" item-value="id"
                  :label="t('supplier_tracking_codes.public_status')" :rules="[requiredNumRule]"
                  :loading="statusesLoading"
                  variant="outlined" density="comfortable" :prepend-inner-icon="mdiFormatListChecks"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="mForm.note" :label="t('supplier_tracking_codes.note')" variant="outlined" density="comfortable" :prepend-inner-icon="mdiNoteTextOutline" />
              </v-col>
            </v-row>
          </v-card-text>
          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="mappedDialog = false">{{ t('common.cancel') }}</v-btn>
            <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" type="button" @click="saveMapped">{{ t('common.save') }}</v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <!-- Dialog: no mapeado (crear/editar) -->
    <v-dialog v-model="unmappedDialog" max-width="560" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiHelpCircleOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editUnmappedId === null ? t('supplier_tracking_codes.new_unmapped') : t('supplier_tracking_codes.edit_unmapped') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="unmappedDialog = false" />
        </div>
        <v-divider />
        <v-form ref="unmappedFormRef" @submit.prevent="saveUnmapped">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="uForm.descr_forn"
                  :label="t('supplier_tracking_codes.code')" :rules="[requiredRule]"
                  variant="outlined" density="comfortable" :prepend-inner-icon="mdiBarcode" autofocus
                />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="uForm.note" :label="t('supplier_tracking_codes.note')" variant="outlined" density="comfortable" :prepend-inner-icon="mdiNoteTextOutline" />
              </v-col>
            </v-row>
          </v-card-text>
          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="unmappedDialog = false">{{ t('common.cancel') }}</v-btn>
            <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" type="button" @click="saveUnmapped">{{ t('common.save') }}</v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiDelete, mdiClose, mdiContentSave, mdiBarcode,
  mdiMapMarkerPath, mdiFormatListChecks, mdiNoteTextOutline, mdiTruckOutline,
  mdiCheckCircle, mdiMinusCircleOutline, mdiCheckAll, mdiArrowRightBold,
  mdiHelpCircleOutline,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import ListingDataView from '../../listing/ListingDataView.vue';
import { useClientSideListSource } from '../../listing/useClientSideListSource';
import type { DataTableHeader } from '../../listing/types';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import type { AnagraficaLite } from '../../anagrafiche/services/anagrafica.service';
import {
  trackingCodesService,
  type TrackingCode,
  type UnmappedCode,
  type PublicStatus,
} from '../services/trackingCodes.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const idFornitore = ref<number | null>(null);
const fornitoreOption = ref<AnagraficaLite | null>(null);
const tab = ref<'mapped' | 'unmapped'>('mapped');

const mapped = ref<TrackingCode[]>([]);
const unmapped = ref<UnmappedCode[]>([]);
const publicStatuses = ref<PublicStatus[]>([]);
const statusesLoading = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

const selectedMapped = ref<{ id: number }[]>([]);
const selectedUnmapped = ref<{ id: number }[]>([]);
const mappedListSource = useClientSideListSource(mapped, { loading });
const unmappedListSource = useClientSideListSource(unmapped, { loading });

const mappedHeaders: DataTableHeader[] = [
  { title: t('supplier_tracking_codes.code') as string, key: 'descr_forn', width: 140 },
  { title: t('supplier_tracking_codes.public_status') as string, key: 'pub_descr' },
  { title: t('supplier_tracking_codes.tipo') as string, key: 'pub_tipo', width: 80, align: 'center' },
  { title: t('supplier_tracking_codes.apri_giac') as string, key: 'pub_apri_giac', width: 90, align: 'center', sortable: false },
  { title: t('supplier_tracking_codes.note') as string, key: 'note', sortable: false },
  { title: t('common.actions') as string, key: 'actions', width: 100, align: 'center', sortable: false },
];
const unmappedHeaders: DataTableHeader[] = [
  { title: t('supplier_tracking_codes.code') as string, key: 'descr_forn', width: 140 },
  { title: t('supplier_tracking_codes.count') as string, key: 'contatore', width: 80, align: 'center' },
  { title: t('supplier_tracking_codes.ai_suggestion') as string, key: 'ai_suggestion', sortable: false },
  { title: t('supplier_tracking_codes.note') as string, key: 'note', sortable: false },
  { title: t('common.actions') as string, key: 'actions', width: 130, align: 'center', sortable: false },
];
const mappedSortKeyMap: Record<string, string> = { descr_forn: 'descr_forn', pub_descr: 'pub_descr', pub_tipo: 'pub_tipo' };
const unmappedSortKeyMap: Record<string, string> = { descr_forn: 'descr_forn', contatore: 'contatore' };

const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');
const requiredNumRule = (v: unknown) => (!!v && Number(v) > 0) || t('common.required');

const statusById = computed(() => {
  const m = new Map<number, PublicStatus>();
  for (const s of publicStatuses.value) m.set(s.id, s);
  return m;
});
function statusLabel(id: number | null): string {
  if (!id) return '';
  return statusById.value.get(id)?.description ?? `#${id}`;
}
function statusTitle(s: PublicStatus): string {
  return `[${s.tipo}] ${s.description}`;
}
function aiColor(status: string | null): string {
  if (status === 'auto_resolved') return 'success';
  if (status === 'needs_review') return 'warning';
  return 'grey';
}

function onFornitoreSelect(opt: AnagraficaLite | null) {
  fornitoreOption.value = opt;
}

async function loadStatuses() {
  if (publicStatuses.value.length) return;
  statusesLoading.value = true;
  try {
    publicStatuses.value = await trackingCodesService.listPublicStatuses();
  } catch {
    publicStatuses.value = [];
  } finally {
    statusesLoading.value = false;
  }
}

async function load() {
  if (!idFornitore.value) return;
  loading.value = true;
  error.value = null;
  try {
    if (tab.value === 'mapped') {
      mapped.value = await trackingCodesService.listMapped(idFornitore.value);
    } else {
      unmapped.value = await trackingCodesService.listUnmapped(idFornitore.value);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// Al cambiar fornitore: recarga ambas listas (para los contadores de tabs).
watch(idFornitore, async (v) => {
  mapped.value = [];
  unmapped.value = [];
  if (!v) return;
  loading.value = true;
  error.value = null;
  try {
    const [m, u] = await Promise.all([
      trackingCodesService.listMapped(v),
      trackingCodesService.listUnmapped(v),
    ]);
    mapped.value = m;
    unmapped.value = u;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});
watch(tab, load);

// ── Mapeado: crear/editar ──
const mappedDialog = ref(false);
const mappedFormRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editMappedId = ref<number | null>(null);
const mForm = reactive({ descr_forn: '', id_tracking_pubblico: null as number | null, note: '' });

function resetMForm() { Object.assign(mForm, { descr_forn: '', id_tracking_pubblico: null, note: '' }); }
async function openCreate() {
  if (tab.value === 'unmapped') return openCreateUnmapped();
  await loadStatuses();
  editMappedId.value = null;
  resetMForm();
  mappedDialog.value = true;
}
/** Acciones de fila (mapeadas): editar (visible) + eliminar en kebab. */
function mappedRowActions(row: TrackingCode): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEditMapped(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeMapped(row) },
  ];
}

async function openEditMapped(row: TrackingCode) {
  await loadStatuses();
  editMappedId.value = row.id;
  Object.assign(mForm, { descr_forn: row.descr_forn, id_tracking_pubblico: row.id_tracking_pubblico, note: row.note ?? '' });
  mappedDialog.value = true;
}
async function saveMapped() {
  const ok = await mappedFormRef.value?.validate();
  if (ok && !ok.valid) return;
  if (!idFornitore.value || !mForm.id_tracking_pubblico) return;
  saving.value = true;
  try {
    const payload = {
      id_fornitore: idFornitore.value,
      descr_forn: mForm.descr_forn.trim(),
      id_tracking_pubblico: mForm.id_tracking_pubblico,
      note: mForm.note.trim(),
    };
    if (editMappedId.value === null) {
      await trackingCodesService.createMapped(payload);
    } else {
      await trackingCodesService.updateMapped(editMappedId.value, payload);
    }
    toast.success(t('common.saved'));
    mappedDialog.value = false;
    await reloadBoth();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
async function removeMapped(row: TrackingCode) {
  const ok = await confirm.askDanger(t('supplier_tracking_codes.delete_confirm', { code: row.descr_forn }), t('supplier_tracking_codes.delete_title'));
  if (!ok) return;
  try {
    await trackingCodesService.removeMapped(row.id);
    toast.success(t('common.deleted'));
    await reloadBoth();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

// ── No mapeado: crear/editar ──
const unmappedDialog = ref(false);
const unmappedFormRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editUnmappedId = ref<number | null>(null);
const uForm = reactive({ descr_forn: '', note: '' });

function openCreateUnmapped() {
  editUnmappedId.value = null;
  Object.assign(uForm, { descr_forn: '', note: '' });
  unmappedDialog.value = true;
}
async function saveUnmapped() {
  const ok = await unmappedFormRef.value?.validate();
  if (ok && !ok.valid) return;
  if (!idFornitore.value) return;
  saving.value = true;
  try {
    const payload = { id_fornitore: idFornitore.value, descr_forn: uForm.descr_forn.trim(), note: uForm.note.trim() };
    if (editUnmappedId.value === null) {
      await trackingCodesService.createUnmapped(payload);
    } else {
      await trackingCodesService.updateUnmapped(editUnmappedId.value, payload);
    }
    toast.success(t('common.saved'));
    unmappedDialog.value = false;
    await reloadBoth();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
async function removeUnmapped(row: UnmappedCode) {
  const ok = await confirm.askDanger(t('supplier_tracking_codes.delete_confirm', { code: row.descr_forn }), t('supplier_tracking_codes.delete_title'));
  if (!ok) return;
  try {
    await trackingCodesService.removeUnmapped(row.id);
    toast.success(t('common.deleted'));
    await reloadBoth();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

/** Promociona un código no mapeado → abre el diálogo de mapeo precargado. */
async function promote(row: UnmappedCode) {
  await loadStatuses();
  editMappedId.value = null;
  Object.assign(mForm, {
    descr_forn: row.descr_forn,
    id_tracking_pubblico: row.ai_suggested_id_pubblico ?? null,
    note: row.note ?? '',
  });
  mappedDialog.value = true;
}

async function reloadBoth() {
  if (!idFornitore.value) return;
  const [m, u] = await Promise.all([
    trackingCodesService.listMapped(idFornitore.value),
    trackingCodesService.listUnmapped(idFornitore.value),
  ]);
  mapped.value = m;
  unmapped.value = u;
}
</script>

<style scoped>
.cm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
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
</style>
