<template>
  <div>
    <CmSectionHeader :title="t('sections.document_models')" :subtitle="t('document_models.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('document_models.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-select
          v-model="linguaFilter"
          :items="linguaOptions"
          :label="t('document_models.lingua')"
          density="compact" hide-details clearable
          style="max-width: 160px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('document_models.new') }}
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
        <CmEmptyState :icon="mdiFileDocumentOutline" :title="t('document_models.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="dm-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:110px">{{ t('document_models.tipo') }}</th>
                <th>{{ t('document_models.descriz') }}</th>
                <th style="width:90px">{{ t('document_models.lingua') }}</th>
                <th class="text-center" style="width:140px">{{ t('document_models.canali') }}</th>
                <th class="text-center" style="width:90px">{{ t('document_models.base') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.tipo }}</b></td>
                <td>{{ row.descriz }}</td>
                <td>{{ row.lingua }}</td>
                <td class="text-center">
                  <span class="dm-chan">
                    <v-icon v-if="row.mail === 'S'" :icon="mdiEmailOutline" size="16" :title="t('document_models.mail')" />
                    <v-icon v-if="row.fax === 'S'" :icon="mdiFax" size="16" :title="t('document_models.fax')" />
                    <v-icon v-if="row.sms === 'S'" :icon="mdiMessageTextOutline" size="16" :title="t('document_models.sms')" />
                    <v-icon v-if="row.carta === 'S'" :icon="mdiFileOutline" size="16" :title="t('document_models.carta')" />
                  </span>
                </td>
                <td class="text-center">
                  <v-chip v-if="isBaseTemplate(row)" size="x-small" color="info" variant="tonal">
                    {{ t('document_models.base') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('document_models.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="920" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiFileDocumentOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">
            {{ editId === null ? t('document_models.new') : t('document_models.edit') }}
          </span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-alert v-if="editingBase" type="info" variant="tonal" density="compact" class="ma-4 mb-0">
          {{ t('document_models.base_readonly_hint') }}
        </v-alert>

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="form.tipo"
                  :label="t('document_models.tipo')"
                  :rules="[requiredRule]"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable" maxlength="10"
                  class="text-uppercase"
                  @update:model-value="(v: string) => (form.tipo = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.descriz"
                  :label="t('document_models.descriz')"
                  :rules="[requiredRule]"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable" maxlength="200"
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="form.lingua"
                  :items="linguaOptions"
                  :label="t('document_models.lingua')"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable"
                />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="form.oggetto"
                  :label="t('document_models.oggetto')"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable" maxlength="200"
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.mittente_msg"
                  :label="t('document_models.mittente_msg')"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable" maxlength="100"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="htmlPurifyBool"
                  :label="t('document_models.html_purify')"
                  :readonly="editingBase"
                  color="primary" density="comfortable" hide-details
                />
              </v-col>

              <v-col cols="12">
                <div class="dm-chan-toggles">
                  <v-checkbox v-model="mailBool" :label="t('document_models.mail')" :readonly="editingBase" density="compact" hide-details />
                  <v-checkbox v-model="faxBool" :label="t('document_models.fax')" :readonly="editingBase" density="compact" hide-details />
                  <v-checkbox v-model="smsBool" :label="t('document_models.sms')" :readonly="editingBase" density="compact" hide-details />
                  <v-checkbox v-model="cartaBool" :label="t('document_models.carta')" :readonly="editingBase" density="compact" hide-details />
                </div>
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="form.html"
                  :label="t('document_models.html')"
                  :readonly="editingBase"
                  variant="outlined" density="comfortable" rows="10" auto-grow
                />
              </v-col>

              <v-col cols="12">
                <div class="dm-preview-label">
                  <v-icon :icon="mdiEyeOutline" size="16" class="mr-1" />
                  {{ t('document_models.preview') }}
                </div>
                <!--
                  `html` es contenido de plantilla libre (puede contener cualquier cosa
                  que un partner haya guardado). NUNCA se renderiza con v-html en el DOM
                  de la página: se aísla en un iframe sandbox SIN allow-scripts, así que
                  cualquier <script> guardado queda inerte.
                -->
                <iframe
                  class="dm-preview-frame"
                  sandbox=""
                  :srcdoc="form.html || ''"
                  :title="t('document_models.preview')"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />
          <v-card-actions class="px-4 py-3">
            <v-spacer />
            <v-btn variant="text" @click="dialogOpen = false">{{ t('common.cancel') }}</v-btn>
            <v-btn
              v-if="!editingBase"
              class="cm-btn-accent" variant="flat" :loading="saving"
              :prepend-icon="mdiContentSave" type="button" @click="doSave"
            >
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
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiFileDocumentOutline, mdiClose,
  mdiContentSave, mdiEmailOutline, mdiFax, mdiMessageTextOutline, mdiFileOutline,
  mdiEyeOutline,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  documentModelsService, type DocumentModel, type DocumentModelPayload, type Lingua, type Flag,
} from '../services/documentModels.service';
import { useProfile } from '../../composables/useProfile';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();
const { idAnagrafica, ensureProfile } = useProfile();

const rows = ref<DocumentModel[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');
const linguaFilter = ref<Lingua | null>(null);

const linguaOptions: Lingua[] = ['ITA', 'ENG', 'SPA', 'FRA'];

// "Base" = plantilla que no pertenece a la sesión actual (típicamente la
// plantilla TMWE compartida, id_anagrafica=1) — el backend (Modelli_Controller,
// F0 anti-IDOR) las expone en lectura para poder clonarlas, pero rechaza
// PUT/DELETE sobre ellas. La UI refleja esa misma regla para no ofrecer una
// acción que el backend igual va a rechazar.
function isBaseTemplate(row: DocumentModel): boolean {
  return idAnagrafica.value !== null && row.id_anagrafica !== idAnagrafica.value;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (linguaFilter.value && r.lingua !== linguaFilter.value) return false;
    if (!q) return true;
    return (
      (r.tipo ?? '').toLowerCase().includes(q) ||
      (r.descriz ?? '').toLowerCase().includes(q) ||
      (r.oggetto ?? '').toLowerCase().includes(q)
    );
  });
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await documentModelsService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const editingBase = ref(false);
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

const form = reactive<DocumentModelPayload>({
  tipo: '',
  html_purify: 'S',
  lingua: 'ITA',
  descriz: '',
  oggetto: '',
  html: '',
  mail: 'N',
  fax: 'N',
  sms: 'N',
  carta: 'N',
  mittente_msg: '',
});

function flagBool(field: keyof DocumentModelPayload) {
  return computed<boolean>({
    get: () => form[field] === 'S',
    set: (v: boolean) => {
      (form[field] as Flag) = v ? 'S' : 'N';
    },
  });
}
const htmlPurifyBool = flagBool('html_purify');
const mailBool = flagBool('mail');
const faxBool = flagBool('fax');
const smsBool = flagBool('sms');
const cartaBool = flagBool('carta');

function resetForm() {
  Object.assign(form, {
    tipo: '', html_purify: 'S', lingua: 'ITA', descriz: '', oggetto: '', html: '',
    mail: 'N', fax: 'N', sms: 'N', carta: 'N', mittente_msg: '',
  });
}
function openCreate() {
  editId.value = null;
  editingBase.value = false;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: DocumentModel) {
  editId.value = row.id;
  editingBase.value = isBaseTemplate(row);
  Object.assign(form, {
    tipo: row.tipo ?? '',
    html_purify: row.html_purify,
    lingua: row.lingua,
    descriz: row.descriz ?? '',
    oggetto: row.oggetto ?? '',
    html: row.html ?? '',
    mail: row.mail,
    fax: row.fax,
    sms: row.sms,
    carta: row.carta,
    mittente_msg: row.mittente_msg ?? '',
  });
  dialogOpen.value = true;
}

function rowActions(row: DocumentModel): RowAction[] {
  const base = isBaseTemplate(row);
  return [
    {
      key: 'edit',
      title: base ? t('document_models.view') : t('common.edit'),
      icon: base ? mdiEyeOutline : mdiPencil,
      onClick: () => openEdit(row),
    },
    {
      key: 'delete',
      title: t('common.delete'),
      icon: mdiDelete,
      color: 'error',
      disabled: base,
      onClick: () => removeRow(row),
    },
  ];
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload: DocumentModelPayload = {
      tipo: form.tipo.trim().toUpperCase(),
      html_purify: form.html_purify,
      lingua: form.lingua,
      descriz: form.descriz.trim(),
      oggetto: form.oggetto.trim(),
      html: form.html,
      mail: form.mail,
      fax: form.fax,
      sms: form.sms,
      carta: form.carta,
      mittente_msg: form.mittente_msg.trim(),
    };
    if (editId.value === null) {
      await documentModelsService.create(payload);
    } else {
      await documentModelsService.update(editId.value, payload);
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

async function removeRow(row: DocumentModel) {
  const ok = await confirm.askDanger(
    t('document_models.delete_confirm', { descriz: row.descriz ?? row.tipo ?? '' }),
    t('document_models.delete_title'),
  );
  if (!ok) return;
  try {
    await documentModelsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(async () => {
  await ensureProfile();
  load();
});
</script>

<style scoped>
.dm-table :deep(th) { font-weight: 600; white-space: nowrap; }
.dm-chan { display: inline-flex; gap: 6px; align-items: center; }
.dm-chan-toggles { display: flex; gap: 20px; flex-wrap: wrap; }
.dm-preview-label {
  font-size: var(--cm-fs-sm, 0.8125rem); font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: flex; align-items: center; margin-bottom: 4px;
}
.dm-preview-frame {
  width: 100%; height: 220px; border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 4px; background: #fff;
}
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
.dm-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.dm-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.dm-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
