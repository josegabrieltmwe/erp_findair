<template>
  <div>
    <CmSectionHeader :title="t('sections.erp_texts')" :subtitle="t('erp_texts.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('erp_texts.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-select
          v-model="lingua"
          :items="linguaItems"
          item-title="label" item-value="code"
          :label="t('erp_texts.lingua')"
          density="compact" hide-details
          style="min-width: 200px"
        />
        <v-select
          v-model="gruppo"
          :items="gruppoItems"
          :label="t('erp_texts.gruppo')"
          density="compact" hide-details clearable
          style="min-width: 240px"
        />
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('erp_texts.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('erp_texts.new') }}
        </v-btn>
      </div>
    </v-card>

    <v-alert v-if="!gruppo && !search" type="info" variant="tonal" density="comfortable" class="mb-4">
      {{ t('erp_texts.pick_filter_hint') }}
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
        <CmEmptyState :icon="mdiTranslate" :title="t('erp_texts.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="et-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:160px">{{ t('erp_texts.chiave') }}</th>
                <th>{{ t('erp_texts.label') }}</th>
                <th style="width:100px">{{ t('erp_texts.tipo') }}</th>
                <th style="width:160px">{{ t('erp_texts.gruppo') }}</th>
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
            <span class="text-caption">{{ t('erp_texts.total', { n: total }) }}</span>
            <v-pagination v-if="pages > 1" v-model="page" :length="pages" density="compact" size="small" />
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="640" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiTranslate" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('erp_texts.new') : t('erp_texts.edit') }}</span>
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
                  :label="t('erp_texts.chiave')"
                  :rules="[requiredRule]"
                  :readonly="editId !== null"
                  variant="outlined" density="comfortable" maxlength="80"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  :label="t('erp_texts.tipo')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.gruppo"
                  :label="t('erp_texts.gruppo')"
                  variant="outlined" density="comfortable" maxlength="80"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.lingua"
                  :items="linguaItems"
                  item-title="label" item-value="code"
                  :label="t('erp_texts.lingua')"
                  :rules="[requiredRule]"
                  :readonly="editId !== null"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.label"
                  :label="t('erp_texts.label')"
                  variant="outlined" density="comfortable" rows="3" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.helpc"
                  :label="t('erp_texts.helpc')"
                  variant="outlined" density="comfortable" rows="2" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.commento"
                  :label="t('erp_texts.commento')"
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiTranslate, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { contactOptionsService, type LanguageOption } from '../../anagrafiche/services/contactOptions.service';
import { erpTextsService, type ErpText, type TestoTipo } from '../services/erpTexts.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const GRUPPO_OPTIONS = [
  'Avvisi JavaScript', 'Contattaci', 'Dettaglio spedizione', 'Fatt proforma',
  'Fattura testi', 'Form presa, rubrica e giacenza', 'Funzione calcolo prezzi',
  'Generali', 'Gestione rubrica', 'Giacenze', 'Home', 'index e menù principali',
  'Lingue', 'Mesi', 'Mostra listino', 'Mostra listino Supplementi',
  'Opzioni avanzate', 'Profilo', 'Proforma motivi esportazione',
  'Proforma unità di misura', 'Ricerca fatture', 'Ricerca spedizioni',
  'Spediz. Multiple', 'Tipo merce cargo Air',
];
const gruppoItems = GRUPPO_OPTIONS;
const tipoItems: TestoTipo[] = ['TX', 'JS', 'LNG', 'MSF', 'MSB'];

const linguaOptions = ref<LanguageOption[]>([]);
const linguaItems = ref<{ code: string; label: string }[]>([]);
const lingua = ref('ITA');
const gruppo = ref<string | null>(null);
const search = ref('');
const page = ref(1);

const rows = ref<ErpText[]>([]);
const total = ref(0);
const pages = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

async function loadLanguages() {
  linguaOptions.value = await contactOptionsService.languages();
  linguaItems.value = linguaOptions.value.length
    ? linguaOptions.value.map((l) => ({ code: l.code, label: l.native || l.name || l.code }))
    : ['ITA', 'ENG', 'SPA', 'FRA', 'TED', 'OLA', 'POR', 'RUS', 'ARB', 'CNS'].map((c) => ({ code: c, label: c }));
}

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
    const result = await erpTextsService.list(page.value, {
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
  tipo: 'TX' as TestoTipo, gruppo: '', lingua: 'ITA', chiave: '', label: '',
  label_noapc: '', label_br: '', helpc: '', help_noapc: '', help_br: '',
  commento: '', attiva_sito: 'S',
});

function resetForm() {
  Object.assign(form, {
    tipo: 'TX', gruppo: gruppo.value ?? '', lingua: lingua.value, chiave: '', label: '',
    label_noapc: '', label_br: '', helpc: '', help_noapc: '', help_br: '',
    commento: '', attiva_sito: 'S',
  });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ErpText) {
  editId.value = row.id;
  Object.assign(form, {
    tipo: row.tipo, gruppo: row.gruppo ?? '', lingua: row.lingua, chiave: row.chiave,
    label: row.label ?? '', label_noapc: row.label_noapc ?? '', label_br: row.label_br ?? '',
    helpc: row.helpc ?? '', help_noapc: row.help_noapc ?? '', help_br: row.help_br ?? '',
    commento: row.commento ?? '', attiva_sito: row.attiva_sito ?? 'S',
  });
  dialogOpen.value = true;
}

function rowActions(row: ErpText): RowAction[] {
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
      attiva_sito: form.attiva_sito,
    };
    if (editId.value === null) {
      await erpTextsService.create(payload);
    } else {
      await erpTextsService.update(editId.value, payload);
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

async function removeRow(row: ErpText) {
  const ok = await confirm.askDanger(
    t('erp_texts.delete_confirm', { chiave: row.chiave }),
    t('erp_texts.delete_title'),
  );
  if (!ok) return;
  try {
    await erpTextsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(async () => {
  await loadLanguages();
  load();
});
</script>

<style scoped>
.et-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.et-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.et-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.et-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
