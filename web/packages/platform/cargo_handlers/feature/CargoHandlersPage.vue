<template>
  <div>
    <CmSectionHeader :title="t('sections.cargo_handlers')" :subtitle="t('cargo_handlers.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <CmAnagraficaAutocomplete
          v-model="idPartner"
          :label="t('cargo_handlers.filter_partner')"
          style="min-width: 280px"
        />
        <v-spacer />
        <v-btn
          class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus"
          :disabled="!idPartner"
          @click="openCreate"
        >
          {{ t('cargo_handlers.new') }}
        </v-btn>
      </div>
    </v-card>

    <v-alert v-if="!idPartner" type="info" variant="tonal" density="comfortable">
      {{ t('cargo_handlers.pick_partner') }}
    </v-alert>

    <CmAsyncSection
      v-else
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="4"
      :skeleton-cols="3"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiAccountHardHat" :title="t('cargo_handlers.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ch-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('cargo_handlers.nome') }}</th>
                <th>{{ t('cargo_handlers.descr') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td><b>{{ row.nome }}</b></td>
                <td>{{ row.descr || '—' }}</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('cargo_handlers.total', { n: rows.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="520" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiAccountHardHat" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('cargo_handlers.new') : t('cargo_handlers.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="form.nome"
                  :label="t('cargo_handlers.nome')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="form.descr"
                  :label="t('cargo_handlers.descr')"
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
import { mdiPlus, mdiPencil, mdiDelete, mdiAccountHardHat, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { cargoHandlersService, type CargoHandler } from '../services/cargoHandlers.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const idPartner = ref<number | null>(null);
const rows = ref<CargoHandler[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

async function load() {
  if (!idPartner.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    rows.value = await cargoHandlersService.listByPartner(idPartner.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch(idPartner, load);

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ nome: '', descr: '' });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { nome: '', descr: '' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CargoHandler) {
  editId.value = row.id;
  Object.assign(form, { nome: row.nome, descr: row.descr ?? '' });
  dialogOpen.value = true;
}

function rowActions(row: CargoHandler): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  if (!idPartner.value) return;
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload = { id_partner: idPartner.value, nome: form.nome.trim(), descr: form.descr.trim() };
    if (editId.value === null) {
      await cargoHandlersService.create(payload);
    } else {
      await cargoHandlersService.update(editId.value, payload);
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

async function removeRow(row: CargoHandler) {
  const ok = await confirm.askDanger(
    t('cargo_handlers.delete_confirm', { nome: row.nome }),
    t('cargo_handlers.delete_title'),
  );
  if (!ok) return;
  try {
    await cargoHandlersService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ch-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.ch-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ch-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ch-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
