<template>
  <div>
    <CmSectionHeader :title="t('sections.extracharges')" :subtitle="t('extracharges.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('extracharges.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('extracharges.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && filtered.length === 0"
      :data="filtered"
      loading-type="skeleton"
      :skeleton-rows="10"
      :skeleton-cols="7"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiPlusBoxMultiple" :title="t('extracharges.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ec-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:60px">{{ t('extracharges.gruppo') }}</th>
                <th>{{ t('extracharges.nome') }}</th>
                <th class="text-center" style="width:80px">{{ t('extracharges.courier') }}</th>
                <th class="text-center" style="width:80px">{{ t('extracharges.cargo') }}</th>
                <th class="text-center" style="width:70px">{{ t('extracharges.import') }}</th>
                <th class="text-center" style="width:70px">{{ t('extracharges.export') }}</th>
                <th class="text-center" style="width:90px">{{ t('extracharges.blocca') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td class="text-center">{{ row.gruppo }}</td>
                <td>
                  <div class="d-flex align-center" style="gap:6px">
                    <v-tooltip v-if="row.auto_applied" :text="t('extracharges.auto_applied_hint')">
                      <template #activator="{ props }">
                        <v-icon v-bind="props" :icon="mdiAlertCircleOutline" color="warning" size="18" />
                      </template>
                    </v-tooltip>
                    <b>{{ row.nome }}</b>
                  </div>
                </td>
                <td class="text-center"><FlagIcon :value="row.courier" /></td>
                <td class="text-center"><FlagIcon :value="row.cargo" /></td>
                <td class="text-center"><FlagIcon :value="row.import" /></td>
                <td class="text-center"><FlagIcon :value="row.export" /></td>
                <td class="text-center"><FlagIcon :value="row.blocca" warn /></td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('extracharges.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="720" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiPlusBoxMultiple" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('extracharges.new') : t('extracharges.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-alert v-if="editingAutoApplied" type="warning" variant="tonal" density="compact" class="mb-4">
              {{ t('extracharges.auto_applied_warning') }}
            </v-alert>

            <v-row dense>
              <v-col cols="12" sm="7">
                <v-text-field v-model="form.nome" :label="t('extracharges.nome')" :rules="[requiredRule]" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="5">
                <v-text-field v-model="form.nome_EN" :label="t('extracharges.nome_en')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model.number="form.gruppo" :label="t('extracharges.gruppo')" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model.number="form.orderby" :label="t('extracharges.orderby')" type="number" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model="form.iso_paese" :label="t('extracharges.iso_paese')" variant="outlined" density="comfortable" maxlength="2" />
              </v-col>
            </v-row>

            <p class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('extracharges.help_section') }}</p>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.help" :label="t('extracharges.help')" variant="outlined" density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.help_EN" :label="t('extracharges.help_en')" variant="outlined" density="comfortable" />
              </v-col>
            </v-row>

            <p class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('extracharges.flags_section') }}</p>
            <v-row dense>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.sped_ckbox" true-value="S" false-value="N" :label="t('extracharges.sped_ckbox')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.courier" true-value="S" false-value="N" :label="t('extracharges.courier')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.cargo" true-value="S" false-value="N" :label="t('extracharges.cargo')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.autosize" true-value="S" false-value="N" :label="t('extracharges.autosize')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.fisso" true-value="S" false-value="N" :label="t('extracharges.fisso')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.import" true-value="S" false-value="N" :label="t('extracharges.import')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.export" true-value="S" false-value="N" :label="t('extracharges.export')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.blocca" true-value="S" false-value="N" :label="t('extracharges.blocca')" density="compact" hide-details color="error" />
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
import { ref, reactive, computed, h, onMounted, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiPlusBoxMultiple, mdiAlertCircleOutline,
  mdiClose, mdiContentSave, mdiCheckCircle, mdiCircleOutline, mdiAlertCircle,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { extrachargesService, type Extracharge, type Flag } from '../services/extracharges.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const FlagIcon = defineComponent({
  props: { value: { type: String, default: 'N' }, warn: { type: Boolean, default: false } },
  setup(props) {
    return () =>
      h('i', {
        class: 'v-icon notranslate v-icon--size-default',
        style: `color:${props.value === 'S' ? (props.warn ? '#e65100' : '#2e7d32') : '#bdbdbd'}`,
      }, [
        h('svg', { viewBox: '0 0 24 24', style: 'width:18px;height:18px;fill:currentColor' }, [
          h('path', { d: props.value === 'S' ? (props.warn ? mdiAlertCircle : mdiCheckCircle) : mdiCircleOutline }),
        ]),
      ]);
  },
});

const rows = ref<Extracharge[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) => r.nome.toLowerCase().includes(q) || r.nome_EN.toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await extrachargesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const editingAutoApplied = ref(false);
const form = reactive({
  nome: '', nome_EN: '', gruppo: 1, orderby: 0, iso_paese: '',
  help: '', help_EN: '',
  sped_ckbox: 'S' as Flag, courier: 'S' as Flag, cargo: 'S' as Flag,
  autosize: 'N' as Flag, fisso: 'N' as Flag, import: 'N' as Flag,
  export: 'N' as Flag, blocca: 'N' as Flag,
});
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, {
    nome: '', nome_EN: '', gruppo: 1, orderby: 0, iso_paese: '',
    help: '', help_EN: '',
    sped_ckbox: 'S', courier: 'S', cargo: 'S',
    autosize: 'N', fisso: 'N', import: 'N', export: 'N', blocca: 'N',
  });
}
function openCreate() {
  editId.value = null;
  editingAutoApplied.value = false;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: Extracharge) {
  editId.value = row.id;
  editingAutoApplied.value = row.auto_applied;
  Object.assign(form, {
    nome: row.nome, nome_EN: row.nome_EN, gruppo: row.gruppo, orderby: row.orderby,
    iso_paese: row.iso_paese ?? '', help: row.help ?? '', help_EN: row.help_EN ?? '',
    sped_ckbox: row.sped_ckbox, courier: row.courier, cargo: row.cargo,
    autosize: row.autosize, fisso: row.fisso, import: row.import,
    export: row.export, blocca: row.blocca,
  });
  dialogOpen.value = true;
}

function rowActions(row: Extracharge): RowAction[] {
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
      nome: form.nome.trim(),
      nome_EN: form.nome_EN.trim(),
      gruppo: Number(form.gruppo) || 1,
      orderby: Number(form.orderby) || 0,
      iso_paese: form.iso_paese.trim().toUpperCase(),
      help: form.help.trim(),
      help_EN: form.help_EN.trim(),
      sped_ckbox: form.sped_ckbox,
      courier: form.courier,
      cargo: form.cargo,
      autosize: form.autosize,
      fisso: form.fisso,
      import: form.import,
      export: form.export,
      blocca: form.blocca,
    };
    if (editId.value === null) {
      await extrachargesService.create(payload);
    } else {
      await extrachargesService.update(editId.value, payload);
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

async function removeRow(row: Extracharge) {
  if (row.auto_applied) {
    const proceed = await confirm.askDanger(
      t('extracharges.delete_auto_applied_warning', { nome: row.nome }),
      t('extracharges.delete_title'),
    );
    if (!proceed) return;
  } else {
    const ok = await confirm.askDanger(
      t('extracharges.delete_confirm', { nome: row.nome }),
      t('extracharges.delete_title'),
    );
    if (!ok) return;
  }
  try {
    await extrachargesService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ec-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.ec-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ec-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ec-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
