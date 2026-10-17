<template>
  <div>
    <CmSectionHeader :title="t('sections.erp_dictionary')" :subtitle="t('erp_dictionary.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('erp_dictionary.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-select
          v-model="lingua"
          :items="linguaItems"
          :label="t('erp_dictionary.lingua')"
          density="compact" hide-details
          style="min-width: 160px"
        />
        <v-select
          v-model="gruppo"
          :items="gruppoItems"
          :label="t('erp_dictionary.gruppo')"
          density="compact" hide-details clearable
          style="min-width: 240px"
        />
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('erp_dictionary.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('erp_dictionary.new') }}
        </v-btn>
      </div>
    </v-card>

    <v-alert v-if="!gruppo && !search" type="info" variant="tonal" density="comfortable" class="mb-4">
      {{ t('erp_dictionary.pick_filter_hint') }}
    </v-alert>

    <CmAsyncSection
      v-else
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="4"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiBookAlphabet" :title="t('erp_dictionary.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ed-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:160px">{{ t('erp_dictionary.chiave') }}</th>
                <th>{{ t('erp_dictionary.label') }}</th>
                <th style="width:90px">{{ t('erp_dictionary.tipo') }}</th>
                <th style="width:160px">{{ t('erp_dictionary.gruppo') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td><code>{{ row.chiave }}</code></td>
                <td>{{ row.label }}</td>
                <td>{{ row.tipo }}</td>
                <td>{{ row.gruppo }}</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-space-between pa-2">
            <span class="text-caption">{{ t('erp_dictionary.total', { n: total }) }}</span>
            <v-pagination v-if="pages > 1" v-model="page" :length="pages" density="compact" size="small" />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="640" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiBookAlphabet" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('erp_dictionary.new') : t('erp_dictionary.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.chiave"
                  :label="t('erp_dictionary.chiave')"
                  :rules="[requiredRule]"
                  :readonly="editId !== null"
                  variant="outlined" density="comfortable" maxlength="20"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  :label="t('erp_dictionary.tipo')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.gruppo"
                  :items="gruppoItems"
                  :label="t('erp_dictionary.gruppo')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.lingua"
                  :items="linguaItems"
                  :label="t('erp_dictionary.lingua')"
                  :rules="[requiredRule]"
                  :readonly="editId !== null"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.label"
                  :label="t('erp_dictionary.label')"
                  variant="outlined" density="comfortable" rows="3" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.helpc"
                  :label="t('erp_dictionary.helpc')"
                  variant="outlined" density="comfortable" rows="2" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.commento"
                  :label="t('erp_dictionary.commento')"
                  variant="outlined" density="comfortable" rows="2" auto-grow
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiBookAlphabet, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  erpDictionaryService, type ErpDictionaryEntry, type ErpDictTipo,
} from '../services/erpDictionary.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

// Verificado en BD: solo ITA/ENG tienen filas en testi_erp hoy.
const linguaItems = ['ITA', 'ENG'];
const GRUPPO_OPTIONS = [
  'Anagrafiche', 'Banche', 'Blocco corrieri', 'Chat', 'CRM', 'Delega partners',
  'Docsstory', 'Fatturazione', 'Fatturazione manuale', 'Generale',
  'Gestione operativa', 'Giacenze', 'Gruppi supplementi', 'Handlers', 'Home',
  'Home 1', 'Home 2', 'Home 3', 'Home 4', 'Home 5', 'Home 6', 'Home 7', 'Home 8',
  'HTML editor', 'Importazioni', 'Menu finestre', 'Mesi e gg', 'Metodi pagamento',
  'Modelli', 'Pagamenti', 'Pagamenti scadenze', 'Profit preset', 'Spedizioni',
  'Vettori cargo',
];
const gruppoItems = GRUPPO_OPTIONS;
const tipoItems: ErpDictTipo[] = ['TX', 'JS', 'MSF', 'MSB', 'DAYF', 'DAYB'];

const lingua = ref('ITA');
const gruppo = ref<string | null>(null);
const search = ref('');
const page = ref(1);

const rows = ref<ErpDictionaryEntry[]>([]);
const total = ref(0);
const pages = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

async function load() {
  if (!gruppo.value && !search.value) {
    rows.value = [];
    total.value = 0;
    pages.value = 1;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const result = await erpDictionaryService.list(page.value, {
      lingua: lingua.value,
      gruppo: gruppo.value ?? undefined,
      search: search.value || undefined,
    });
    rows.value = result.items;
    total.value = result.total;
    pages.value = result.pages;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch([lingua, gruppo, search], () => {
  page.value = 1;
  load();
});
watch(page, load);

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

const form = reactive({
  tipo: 'TX' as ErpDictTipo, gruppo: '', lingua: 'ITA', chiave: '', label: '',
  label_noapc: 'N' as 'S' | 'N', label_br: 'NO' as 'NO' | 'NL' | 'BR',
  helpc: '', help_noapc: 'N' as 'S' | 'N', help_br: 'NO' as 'NO' | 'NL' | 'BR',
  commento: '',
});

function resetForm() {
  Object.assign(form, {
    tipo: 'TX', gruppo: gruppo.value ?? '', lingua: lingua.value, chiave: '', label: '',
    label_noapc: 'N', label_br: 'NO', helpc: '', help_noapc: 'N', help_br: 'NO', commento: '',
  });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ErpDictionaryEntry) {
  editId.value = row.id;
  Object.assign(form, {
    tipo: row.tipo, gruppo: row.gruppo ?? '', lingua: row.lingua, chiave: row.chiave,
    label: row.label ?? '', label_noapc: row.label_noapc, label_br: row.label_br,
    helpc: row.helpc ?? '', help_noapc: row.help_noapc, help_br: row.help_br,
    commento: row.commento ?? '',
  });
  dialogOpen.value = true;
}

function rowActions(row: ErpDictionaryEntry): RowAction[] {
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
      tipo: form.tipo,
      gruppo: form.gruppo.trim(),
      lingua: form.lingua,
      chiave: form.chiave.trim(),
      label: form.label,
      label_noapc: form.label_noapc,
      label_br: form.label_br,
      helpc: form.helpc,
      help_noapc: form.help_noapc,
      help_br: form.help_br,
      commento: form.commento,
    };
    if (editId.value === null) {
      await erpDictionaryService.create(payload);
    } else {
      await erpDictionaryService.update(editId.value, payload);
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

async function removeRow(row: ErpDictionaryEntry) {
  const ok = await confirm.askDanger(
    t('erp_dictionary.delete_confirm', { chiave: row.chiave }),
    t('erp_dictionary.delete_title'),
  );
  if (!ok) return;
  try {
    await erpDictionaryService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ed-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.ed-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ed-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ed-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
