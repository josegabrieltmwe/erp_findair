<template>
  <div>
    <CmSectionHeader :title="t('sections.crm_types')" :subtitle="t('crm_types.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('crm_types.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('crm_types.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="6"
      :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiFormatListBulleted" :title="t('crm_types.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ct-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('crm_types.descr') }}</th>
                <th>{{ t('crm_types.descrEN') }}</th>
                <th style="width:110px">{{ t('crm_types.tipo_voce') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.descr }}</b></td>
                <td>{{ row.descrEN }}</td>
                <td>
                  <v-chip size="x-small" variant="tonal" :color="tipoColor(row.tipo_voce)">
                    {{ tipoLabel(row.tipo_voce) }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('crm_types.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="520" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiFormatListBulleted" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('crm_types.new') : t('crm_types.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="form.descr"
                  :label="t('crm_types.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="200"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="form.descrEN"
                  :label="t('crm_types.descrEN')"
                  variant="outlined" density="comfortable" maxlength="200"
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="form.tipo_voce"
                  :items="tipoItems"
                  item-title="title" item-value="value"
                  :label="t('crm_types.tipo_voce')"
                  :rules="[requiredRule]"
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiFormatListBulleted, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { crmTypesService, type CrmType, type TipoVoce } from '../services/crmTypes.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<CrmType[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const tipoItems = [
  { title: t('crm_types.tipo_p'), value: 'P' },
  { title: t('crm_types.tipo_i'), value: 'I' },
  { title: t('crm_types.tipo_t'), value: 'T' },
];

function tipoLabel(v: TipoVoce): string {
  return tipoItems.find((i) => i.value === v)?.title ?? v;
}
function tipoColor(v: TipoVoce): string {
  return v === 'P' ? 'primary' : v === 'I' ? 'secondary' : 'default';
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) => r.descr.toLowerCase().includes(q) || (r.descrEN ?? '').toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await crmTypesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ descr: '', descrEN: '', tipo_voce: 'P' as TipoVoce });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { descr: '', descrEN: '', tipo_voce: 'P' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CrmType) {
  editId.value = row.id;
  Object.assign(form, { descr: row.descr, descrEN: row.descrEN ?? '', tipo_voce: row.tipo_voce });
  dialogOpen.value = true;
}

function rowActions(row: CrmType): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload = {
      descr: form.descr.trim(),
      descrEN: form.descrEN.trim(),
      tipo_voce: form.tipo_voce,
    };
    if (editId.value === null) {
      await crmTypesService.create(payload);
    } else {
      await crmTypesService.update(editId.value, payload);
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

async function removeRow(row: CrmType) {
  const ok = await confirm.askDanger(
    t('crm_types.delete_confirm', { descr: row.descr }),
    t('crm_types.delete_title'),
  );
  if (!ok) return;
  try {
    await crmTypesService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ct-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.ct-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ct-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ct-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
