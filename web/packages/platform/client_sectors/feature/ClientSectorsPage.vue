<template>
  <div>
    <CmSectionHeader :title="t('sections.client_sectors')" :subtitle="t('client_sectors.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('client_sectors.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('client_sectors.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="5"
      :skeleton-cols="3"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiBriefcaseOutline" :title="t('client_sectors.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cs-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('client_sectors.descr') }}</th>
                <th>{{ t('client_sectors.studi_settore') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.descr }}</b></td>
                <td>{{ settoreLabel(row.id_studi_settore) }}</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('client_sectors.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="480" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiBriefcaseOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('client_sectors.new') : t('client_sectors.edit') }}</span>
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
                  :label="t('client_sectors.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="50"
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="form.id_studi_settore"
                  :items="settoreItems"
                  item-title="descr" item-value="id"
                  :label="t('client_sectors.studi_settore')"
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiBriefcaseOutline, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { clientSectorsService, type ClientSector } from '../services/clientSectors.service';
import { fiscalSettingsService, type FiscalSetting } from '../../fiscal_settings/services/fiscalSettings.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<ClientSector[]>([]);
const settori = ref<FiscalSetting[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const settoreItems = computed(() => settori.value.filter((s) => s.stato === 'A'));

function settoreLabel(id: number): string {
  return settori.value.find((s) => s.id === id)?.descr ?? String(id);
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((r) => r.descr.toLowerCase().includes(q));
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [sectors, settoriList] = await Promise.all([
      clientSectorsService.list(),
      fiscalSettingsService.list(),
    ]);
    rows.value = sectors;
    settori.value = settoriList;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ descr: '', id_studi_settore: null as number | null });
const requiredRule = (v: unknown) => (v !== null && v !== '' && v !== undefined) || t('common.required');

function resetForm() {
  Object.assign(form, { descr: '', id_studi_settore: null });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ClientSector) {
  editId.value = row.id;
  Object.assign(form, { descr: row.descr, id_studi_settore: row.id_studi_settore });
  dialogOpen.value = true;
}

function rowActions(row: ClientSector): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  if (form.id_studi_settore === null) return;
  saving.value = true;
  try {
    const payload = { descr: form.descr.trim(), id_studi_settore: form.id_studi_settore };
    if (editId.value === null) {
      await clientSectorsService.create(payload);
    } else {
      await clientSectorsService.update(editId.value, payload);
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

async function removeRow(row: ClientSector) {
  const ok = await confirm.askDanger(
    t('client_sectors.delete_confirm', { descr: row.descr }),
    t('client_sectors.delete_title'),
  );
  if (!ok) return;
  try {
    await clientSectorsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.cs-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.cs-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.cs-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.cs-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
