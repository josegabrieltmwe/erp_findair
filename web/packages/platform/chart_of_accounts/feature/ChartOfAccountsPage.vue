<template>
  <div>
    <CmSectionHeader :title="t('sections.chart_of_accounts')" :subtitle="t('chart_of_accounts.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('chart_of_accounts.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('chart_of_accounts.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="7"
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiFinance" :title="t('chart_of_accounts.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="coa-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:100px">{{ t('chart_of_accounts.codice') }}</th>
                <th>{{ t('chart_of_accounts.descr') }}</th>
                <th class="text-right" style="width:120px" :title="t('chart_of_accounts.detraibilita_hint')">{{ t('chart_of_accounts.detraibilita') }}</th>
                <th class="text-right" style="width:140px" :title="t('chart_of_accounts.detraibilita_iva_hint')">{{ t('chart_of_accounts.detraibilita_iva') }}</th>
                <th class="text-center" style="width:100px">{{ t('chart_of_accounts.stato') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.codice }}</b></td>
                <td>{{ row.descr }}</td>
                <td class="text-right">{{ formatPct(row.detraibilita) }}</td>
                <td class="text-right">{{ formatPct(row.detraibilitaIVA) }}</td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.stato === 'A' ? 'success' : 'default'" variant="tonal">
                    {{ row.stato === 'A' ? t('chart_of_accounts.stato_a') : t('chart_of_accounts.stato_o') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('chart_of_accounts.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="560" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiFinance" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('chart_of_accounts.new') : t('chart_of_accounts.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.codice"
                  :label="t('chart_of_accounts.codice')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="30"
                />
              </v-col>
              <v-col cols="12" sm="8">
                <v-text-field
                  v-model="form.descr"
                  :label="t('chart_of_accounts.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="50"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="form.detraibilita"
                  :label="t('chart_of_accounts.detraibilita')"
                  :hint="t('chart_of_accounts.detraibilita_hint')" persistent-hint
                  type="number" min="0" max="100" step="0.01"
                  suffix="%"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model.number="form.detraibilitaIVA"
                  :label="t('chart_of_accounts.detraibilita_iva')"
                  :hint="t('chart_of_accounts.detraibilita_iva_hint')" persistent-hint
                  type="number" min="0" max="100" step="0.01"
                  suffix="%"
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiFinance, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { chartOfAccountsService, type ChartAccount } from '../services/chartOfAccounts.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<ChartAccount[]>([]);
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

function formatPct(v: number): string {
  return `${Number(v).toFixed(2)}%`;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await chartOfAccountsService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ codice: '', descr: '', detraibilita: 0, detraibilitaIVA: 0 });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { codice: '', descr: '', detraibilita: 0, detraibilitaIVA: 0 });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ChartAccount) {
  editId.value = row.id;
  Object.assign(form, {
    codice: row.codice,
    descr: row.descr,
    detraibilita: row.detraibilita,
    detraibilitaIVA: row.detraibilitaIVA,
  });
  dialogOpen.value = true;
}

function rowActions(row: ChartAccount): RowAction[] {
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
      codice: form.codice.trim(),
      descr: form.descr.trim(),
      detraibilita: Number(form.detraibilita) || 0,
      detraibilitaIVA: Number(form.detraibilitaIVA) || 0,
    };
    if (editId.value === null) {
      await chartOfAccountsService.create(payload);
    } else {
      await chartOfAccountsService.update(editId.value, payload);
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

async function removeRow(row: ChartAccount) {
  const ok = await confirm.askDanger(
    t('chart_of_accounts.delete_confirm', { descr: row.descr }),
    t('chart_of_accounts.delete_title'),
  );
  if (!ok) return;
  try {
    await chartOfAccountsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.coa-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.coa-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.coa-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.coa-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
