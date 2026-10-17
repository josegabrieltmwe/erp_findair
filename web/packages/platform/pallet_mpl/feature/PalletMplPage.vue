<template>
  <div>
    <CmSectionHeader :title="t('sections.pallet_mpl')" :subtitle="t('pallet_mpl.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <CmAnagraficaAutocomplete
          v-model="idFornitore"
          :label="t('pallet_mpl.filter_fornitore')"
          style="min-width: 280px"
        />
        <v-spacer />
        <v-btn
          class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus"
          :disabled="!idFornitore"
          @click="openCreate"
        >
          {{ t('pallet_mpl.new') }}
        </v-btn>
      </div>
    </v-card>

    <v-alert v-if="!idFornitore" type="info" variant="tonal" density="comfortable">
      {{ t('pallet_mpl.pick_fornitore') }}
    </v-alert>

    <CmAsyncSection
      v-else
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="7"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiShippingPallet" :title="t('pallet_mpl.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="pm-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('pallet_mpl.nome') }}</th>
                <th style="width:90px">{{ t('pallet_mpl.code_type') }}</th>
                <th style="width:80px">{{ t('pallet_mpl.internaz') }}</th>
                <th class="text-right" style="width:80px">{{ t('pallet_mpl.mpl') }}</th>
                <th class="text-right" style="width:70px">{{ t('pallet_mpl.qta') }}</th>
                <th class="text-right" style="width:100px">{{ t('pallet_mpl.p') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td><b>{{ row.nome || '—' }}</b></td>
                <td>{{ row.code_type }}</td>
                <td>{{ internazLabel(row.internaz) }}</td>
                <td class="text-right">{{ row.mpl }}</td>
                <td class="text-right">{{ row.qta }}</td>
                <td class="text-right">{{ row.p }} kg</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('pallet_mpl.total', { n: rows.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="600" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiShippingPallet" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('pallet_mpl.new') : t('pallet_mpl.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="7">
                <v-text-field
                  v-model="form.nome"
                  :label="t('pallet_mpl.nome')"
                  variant="outlined" density="comfortable" maxlength="25"
                />
              </v-col>
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="form.code_type"
                  :label="t('pallet_mpl.code_type')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="10"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.internaz"
                  :items="internazItems"
                  item-title="title" item-value="value"
                  :label="t('pallet_mpl.internaz')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="4" sm="2">
                <v-text-field
                  v-model.number="form.mpl"
                  :label="t('pallet_mpl.mpl')"
                  type="number" step="0.01" min="0"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="4" sm="3">
                <v-text-field
                  v-model.number="form.qta"
                  :label="t('pallet_mpl.qta')"
                  type="number" min="0"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="4" sm="3">
                <v-text-field
                  v-model.number="form.p"
                  :label="t('pallet_mpl.p')"
                  type="number" min="0"
                  suffix="kg"
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
import { ref, reactive, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiShippingPallet, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { palletMplService, type PalletMpl, type Internaz } from '../services/palletMpl.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const idFornitore = ref<number | null>(null);
const rows = ref<PalletMpl[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

const internazItems = [
  { title: t('pallet_mpl.internaz_nz'), value: 'NZ' },
  { title: t('pallet_mpl.internaz_in'), value: 'IN' },
  { title: t('pallet_mpl.internaz_al'), value: 'AL' },
];

function internazLabel(v: Internaz): string {
  return internazItems.find((i) => i.value === v)?.title ?? v;
}

async function load() {
  if (!idFornitore.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    rows.value = await palletMplService.listByFornitore(idFornitore.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch(idFornitore, load);

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({
  nome: '', code_type: '', internaz: 'NZ' as Internaz, mpl: 0, qta: 0, p: 0,
});
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { nome: '', code_type: '', internaz: 'NZ', mpl: 0, qta: 0, p: 0 });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: PalletMpl) {
  editId.value = row.id;
  Object.assign(form, {
    nome: row.nome, code_type: row.code_type, internaz: row.internaz,
    mpl: row.mpl, qta: row.qta, p: row.p,
  });
  dialogOpen.value = true;
}

function rowActions(row: PalletMpl): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  if (!idFornitore.value) return;
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload = {
      id_fornitore: idFornitore.value,
      nome: form.nome.trim(),
      code_type: form.code_type.trim(),
      internaz: form.internaz,
      mpl: Number(form.mpl) || 0,
      qta: Number(form.qta) || 0,
      p: Number(form.p) || 0,
    };
    if (editId.value === null) {
      await palletMplService.create(payload);
    } else {
      await palletMplService.update(editId.value, payload);
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

async function removeRow(row: PalletMpl) {
  const ok = await confirm.askDanger(
    t('pallet_mpl.delete_confirm', { code: row.code_type }),
    t('pallet_mpl.delete_title'),
  );
  if (!ok) return;
  try {
    await palletMplService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.pm-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.pm-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.pm-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.pm-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
