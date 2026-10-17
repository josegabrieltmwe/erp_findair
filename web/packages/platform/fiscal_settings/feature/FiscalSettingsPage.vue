<template>
  <div>
    <CmSectionHeader :title="t('sections.fiscal_settings')" :subtitle="t('fiscal_settings.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('fiscal_settings.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('fiscal_settings.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="4"
      :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiDomain" :title="t('fiscal_settings.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="fs-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:120px">{{ t('fiscal_settings.codice') }}</th>
                <th>{{ t('fiscal_settings.descr') }}</th>
                <th class="text-center" style="width:100px">{{ t('fiscal_settings.stato') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.codice }}</b></td>
                <td>{{ row.descr }}</td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.stato === 'A' ? 'success' : 'default'" variant="tonal">
                    {{ row.stato === 'A' ? t('fiscal_settings.stato_a') : t('fiscal_settings.stato_o') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('fiscal_settings.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="480" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiDomain" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('fiscal_settings.new') : t('fiscal_settings.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="form.codice"
                  :label="t('fiscal_settings.codice')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="30"
                  class="text-uppercase"
                  @update:model-value="(v: string) => (form.codice = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="7">
                <v-text-field
                  v-model="form.descr"
                  :label="t('fiscal_settings.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="50"
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiDomain, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { fiscalSettingsService, type FiscalSetting } from '../services/fiscalSettings.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<FiscalSetting[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) => r.codice.toLowerCase().includes(q) || r.descr.toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fiscalSettingsService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ codice: '', descr: '' });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { codice: '', descr: '' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: FiscalSetting) {
  editId.value = row.id;
  Object.assign(form, { codice: row.codice, descr: row.descr });
  dialogOpen.value = true;
}

function rowActions(row: FiscalSetting): RowAction[] {
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
    const payload = { codice: form.codice.trim().toUpperCase(), descr: form.descr.trim() };
    if (editId.value === null) {
      await fiscalSettingsService.create(payload);
    } else {
      await fiscalSettingsService.update(editId.value, payload);
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

async function removeRow(row: FiscalSetting) {
  const ok = await confirm.askDanger(
    t('fiscal_settings.delete_confirm', { descr: row.descr }),
    t('fiscal_settings.delete_title'),
  );
  if (!ok) return;
  try {
    await fiscalSettingsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.fs-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.fs-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.fs-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.fs-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
