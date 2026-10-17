<template>
  <div>
    <CmSectionHeader :title="t('sections.cargo_charges')" :subtitle="t('cargo_charges.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('cargo_charges.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('cargo_charges.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-select
          v-model="tipoFilter"
          :items="tipoItems"
          item-title="title" item-value="value"
          :label="t('cargo_charges.filter_tipo')"
          density="compact" hide-details clearable
          style="max-width: 160px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('cargo_charges.new') }}
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
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiCashPlus" :title="t('cargo_charges.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cc-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:100px">{{ t('cargo_charges.sigla') }}</th>
                <th>{{ t('cargo_charges.label_ita') }}</th>
                <th style="width:80px">{{ t('cargo_charges.tipo') }}</th>
                <th class="text-center" style="width:110px">{{ t('cargo_charges.scelta') }}</th>
                <th class="text-center" style="width:90px">{{ t('cargo_charges.vista') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b class="cc-mono">{{ row.sigla }}</b></td>
                <td>{{ row.label_ITA || row.label_orig || '—' }}</td>
                <td>{{ row.tipo === 'A' ? t('cargo_charges.tipo_a') : t('cargo_charges.tipo_s') }}</td>
                <td class="text-center">
                  <v-chip size="x-small" variant="tonal" :color="row.scelta === 'S' ? 'success' : 'default'">
                    {{ scelta_label(row.scelta) }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <v-icon v-if="row.vista === 'S'" :icon="mdiEyeOutline" size="16" />
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('cargo_charges.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="620" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiCashPlus" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('cargo_charges.new') : t('cargo_charges.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.sigla"
                  :label="t('cargo_charges.sigla')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="10"
                  class="text-uppercase"
                  @update:model-value="(v: string) => (form.sigla = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  item-title="title" item-value="value"
                  :label="t('cargo_charges.tipo')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.scelta"
                  :items="sceltaItems"
                  item-title="title" item-value="value"
                  :label="t('cargo_charges.scelta')"
                  :hint="t('cargo_charges.scelta_hint')"
                  persistent-hint
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.label_ITA" :label="t('cargo_charges.label_ita')" variant="outlined" density="comfortable" maxlength="100" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.label_ENG" :label="t('cargo_charges.label_eng')" variant="outlined" density="comfortable" maxlength="100" />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="form.label_orig" :label="t('cargo_charges.label_orig')" variant="outlined" density="comfortable" maxlength="100" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch v-model="vistaBool" :label="t('cargo_charges.vista')" color="primary" density="comfortable" hide-details />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.note" :label="t('cargo_charges.note')" variant="outlined" density="comfortable" rows="2" auto-grow />
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiCashPlus, mdiClose, mdiContentSave, mdiEyeOutline } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  cargoChargesService, type CargoCharge, type CargoChargeTipo, type CargoChargeScelta, type SN,
} from '../services/cargoCharges.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<CargoCharge[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');
const tipoFilter = ref<CargoChargeTipo | null>(null);

const tipoItems = [
  { title: t('cargo_charges.tipo_a'), value: 'A' },
  { title: t('cargo_charges.tipo_s'), value: 'S' },
];
const sceltaItems = [
  { title: t('cargo_charges.scelta_s'), value: 'S' },
  { title: t('cargo_charges.scelta_e'), value: 'E' },
  { title: t('cargo_charges.scelta_h'), value: 'H' },
];

function scelta_label(v: CargoChargeScelta): string {
  return sceltaItems.find((i) => i.value === v)?.title ?? (v || '—');
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (tipoFilter.value && r.tipo !== tipoFilter.value) return false;
    if (!q) return true;
    return (
      r.sigla.toLowerCase().includes(q) ||
      (r.label_ITA ?? '').toLowerCase().includes(q) ||
      (r.label_ENG ?? '').toLowerCase().includes(q)
    );
  });
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await cargoChargesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

const form = reactive({
  sigla: '', tipo: 'A' as CargoChargeTipo, label_orig: '', label_ITA: '', label_ENG: '',
  scelta: 'S' as CargoChargeScelta, note: '', vista: 'S' as SN,
});
const vistaBool = computed<boolean>({
  get: () => form.vista === 'S',
  set: (v: boolean) => { form.vista = v ? 'S' : 'N'; },
});

function resetForm() {
  Object.assign(form, {
    sigla: '', tipo: 'A', label_orig: '', label_ITA: '', label_ENG: '',
    scelta: 'S', note: '', vista: 'S',
  });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CargoCharge) {
  editId.value = row.id;
  Object.assign(form, {
    sigla: row.sigla, tipo: row.tipo, label_orig: row.label_orig ?? '',
    label_ITA: row.label_ITA ?? '', label_ENG: row.label_ENG ?? '',
    scelta: row.scelta || 'S', note: row.note ?? '', vista: row.vista,
  });
  dialogOpen.value = true;
}

function rowActions(row: CargoCharge): RowAction[] {
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
      sigla: form.sigla.trim().toUpperCase(),
      tipo: form.tipo,
      label_orig: form.label_orig.trim(),
      label_ITA: form.label_ITA.trim(),
      label_ENG: form.label_ENG.trim(),
      scelta: form.scelta,
      note: form.note.trim(),
      vista: form.vista,
    };
    if (editId.value === null) {
      await cargoChargesService.create(payload);
    } else {
      await cargoChargesService.update(editId.value, payload);
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

async function removeRow(row: CargoCharge) {
  const ok = await confirm.askDanger(
    t('cargo_charges.delete_confirm', { sigla: row.sigla }),
    t('cargo_charges.delete_title'),
  );
  if (!ok) return;
  try {
    await cargoChargesService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.cc-table :deep(th) { font-weight: 600; white-space: nowrap; }
.cc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
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
.cc-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.cc-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.cc-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
