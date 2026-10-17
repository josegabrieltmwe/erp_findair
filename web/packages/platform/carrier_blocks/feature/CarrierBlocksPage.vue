<template>
  <div>
    <CmSectionHeader :title="t('sections.carrier_blocks')" :subtitle="t('carrier_blocks.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:flex-end">
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('carrier_blocks.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="4"
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiCancel" :title="t('carrier_blocks.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cb-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('carrier_blocks.carrier') }}</th>
                <th class="text-center" style="width:110px">{{ t('carrier_blocks.tmwe_all') }}</th>
                <th style="width:180px">{{ t('carrier_blocks.solo_paesi') }}</th>
                <th style="width:110px">{{ t('carrier_blocks.solo_dal') }}</th>
                <th style="width:110px">{{ t('carrier_blocks.solo_al') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ carrierNames[row.id_corriere] ?? `#${row.id_corriere}` }}</td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.tmwe_all === 'S' ? 'error' : 'default'" variant="tonal">
                    {{ row.tmwe_all === 'S' ? t('common.yes') : t('common.no') }}
                  </v-chip>
                </td>
                <td>{{ (row.solo_paesi || '').trim() || '—' }}</td>
                <td>{{ formatDate(row.solo_dal) }}</td>
                <td>{{ formatDate(row.solo_al) }}</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('carrier_blocks.total', { n: rows.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="600" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiCancel" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('carrier_blocks.new') : t('carrier_blocks.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12">
                <CmAnagraficaAutocomplete
                  v-model="form.id_corriere"
                  :label="t('carrier_blocks.carrier')"
                  :rules="[requiredCarrierRule]"
                  :disabled="editId !== null"
                />
                <p v-if="editId !== null" class="text-caption text-medium-emphasis mt-1">
                  {{ t('carrier_blocks.carrier_locked_hint') }}
                </p>
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="form.tmwe_all"
                  true-value="S" false-value="N"
                  :label="t('carrier_blocks.tmwe_all')"
                  :hint="t('carrier_blocks.tmwe_all_hint')" persistent-hint
                  density="compact" color="error"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.solo_paesi"
                  :label="t('carrier_blocks.solo_paesi')"
                  :hint="t('carrier_blocks.solo_paesi_hint')" persistent-hint
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.solo_dal"
                  :label="t('carrier_blocks.solo_dal')"
                  type="date"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.solo_al"
                  :label="t('carrier_blocks.solo_al')"
                  type="date"
                  variant="outlined" density="comfortable"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
            <v-btn class="cm-btn-accent" variant="flat" :loading="saving" :prepend-icon="mdiContentSave" type="button" @click="doSave">
              {{ t('common.save') }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiCancel, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { anagraficaService } from '@shared/anagrafiche/services/anagrafica.service';
import { carrierBlocksService, type CarrierBlock, type Flag } from '../services/carrierBlocks.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<CarrierBlock[]>([]);
const carrierNames = reactive<Record<number, string>>({});
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

function formatDate(v: string | null): string {
  if (!v || v === '0000-00-00') return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function resolveCarrierNames(list: CarrierBlock[]) {
  const ids = Array.from(new Set(list.map((r) => r.id_corriere))).filter((id) => !carrierNames[id]);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const a = await anagraficaService.getById(id);
        if (a) carrierNames[id] = a.nome_breve ? `${a.rag_soc} (${a.nome_breve})` : a.rag_soc;
      } catch {
        // deja el fallback #id en la plantilla
      }
    }),
  );
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await carrierBlocksService.list();
    await resolveCarrierNames(rows.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({
  id_corriere: null as number | null,
  tmwe_all: 'N' as Flag,
  solo_paesi: '',
  solo_dal: '',
  solo_al: '',
});
const requiredCarrierRule = (v: unknown) => v !== null || t('common.required');

function resetForm() {
  Object.assign(form, { id_corriere: null, tmwe_all: 'N', solo_paesi: '', solo_dal: '', solo_al: '' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CarrierBlock) {
  editId.value = row.id;
  Object.assign(form, {
    id_corriere: row.id_corriere,
    tmwe_all: row.tmwe_all,
    solo_paesi: (row.solo_paesi || '').trim(),
    solo_dal: row.solo_dal && row.solo_dal !== '0000-00-00' ? row.solo_dal : '',
    solo_al: row.solo_al && row.solo_al !== '0000-00-00' ? row.solo_al : '',
  });
  dialogOpen.value = true;
}

function rowActions(row: CarrierBlock): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  if (!form.id_corriere) return;
  saving.value = true;
  try {
    const payload = {
      id_corriere: form.id_corriere,
      tmwe_all: form.tmwe_all,
      solo_paesi: form.solo_paesi.trim(),
      solo_dal: form.solo_dal || null,
      solo_al: form.solo_al || null,
    };
    if (editId.value === null) {
      await carrierBlocksService.create(payload);
    } else {
      await carrierBlocksService.update(editId.value, payload);
    }
    toast.success(t('common.saved'));
    dialogOpen.value = false;
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function removeRow(row: CarrierBlock) {
  const ok = await confirm.askDanger(
    t('carrier_blocks.delete_confirm', { carrier: carrierNames[row.id_corriere] ?? `#${row.id_corriere}` }),
    t('carrier_blocks.delete_title'),
  );
  if (!ok) return;
  try {
    await carrierBlocksService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.cb-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.cb-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.cb-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.cb-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
