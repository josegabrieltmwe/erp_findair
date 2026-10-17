<template>
  <div>
    <CmSectionHeader :title="t('sections.customs_agencies')" :subtitle="t('customs_agencies.subtitle')" />

    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('customs_agencies.live_warning') }}
    </v-alert>

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('customs_agencies.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <CmAnagraficaAutocomplete
          v-model="partnerFilter"
          :label="t('customs_agencies.filter_partner')"
          style="min-width: 260px"
          clearable
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('customs_agencies.new') }}
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
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiOfficeBuildingOutline" :title="t('customs_agencies.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="ca-table cm-table-zebra">
            <thead>
              <tr>
                <th>{{ t('customs_agencies.nome') }}</th>
                <th style="width:140px">{{ t('customs_agencies.partner') }}</th>
                <th class="text-center" style="width:90px">{{ t('customs_agencies.blocca') }}</th>
                <th class="text-center" style="width:90px">{{ t('customs_agencies.okpartners') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.nome }}</b></td>
                <td>{{ row.id_anagr_titolare }}</td>
                <td class="text-center">
                  <v-chip v-if="row.blocca === 'S'" size="x-small" color="error" variant="tonal">
                    {{ t('customs_agencies.blocked') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <v-icon v-if="row.okpartners === 'S'" :icon="mdiCheck" size="16" color="success" />
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('customs_agencies.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="720" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiOfficeBuildingOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">
            {{ editId === null ? t('customs_agencies.new') : t('customs_agencies.edit') }}
          </span>
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
                  :label="t('customs_agencies.nome')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="150"
                />
              </v-col>
              <v-col cols="12" sm="5">
                <CmAnagraficaAutocomplete
                  v-model="partnerModel"
                  :label="t('customs_agencies.partner')"
                  :hint="t('customs_agencies.partner_hint')"
                  persistent-hint
                />
              </v-col>

              <v-col cols="12" sm="6">
                <v-switch
                  v-model="blockaBool"
                  :label="t('customs_agencies.blocca')"
                  :hint="t('customs_agencies.blocca_hint')"
                  persistent-hint
                  color="error" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-switch
                  v-model="okpartnersBool"
                  :label="t('customs_agencies.okpartners')"
                  color="primary" density="comfortable" hide-details
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="form.import_iso"
                  :label="t('customs_agencies.import_iso')"
                  :hint="t('customs_agencies.iso_hint')"
                  persistent-hint
                  variant="outlined" density="comfortable" rows="2" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.export_iso"
                  :label="t('customs_agencies.export_iso')"
                  :hint="t('customs_agencies.iso_hint')"
                  persistent-hint
                  variant="outlined" density="comfortable" rows="2" auto-grow
                />
              </v-col>

              <v-col cols="12">
                <div class="ca-section-label">{{ t('customs_agencies.emails_section') }}</div>
                <div class="ca-hint">{{ t('customs_agencies.emails_hint') }}</div>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.email" :label="t('customs_agencies.email')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.email2" :label="t('customs_agencies.email2')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.email3" :label="t('customs_agencies.email3')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.email4" :label="t('customs_agencies.email4')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="form.email5" :label="t('customs_agencies.email5')" variant="outlined" density="comfortable" maxlength="50" />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="form.note_open"
                  :label="t('customs_agencies.note_open')"
                  variant="outlined" density="comfortable" rows="2" auto-grow
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.note_interne"
                  :label="t('customs_agencies.note_interne')"
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
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiOfficeBuildingOutline, mdiClose,
  mdiContentSave, mdiCheck,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import CmAnagraficaAutocomplete from '../../listini/components/CmAnagraficaAutocomplete.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  customsAgenciesService, type CustomsAgency, type CustomsAgencyPayload, type SN,
} from '../services/customsAgencies.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<CustomsAgency[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');
const partnerFilter = ref<number | null>(null);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (partnerFilter.value && r.id_anagr_titolare !== partnerFilter.value) return false;
    if (!q) return true;
    return (r.nome ?? '').toLowerCase().includes(q);
  });
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await customsAgenciesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const partnerModel = ref<number | null>(null);
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

const form = reactive({
  nome: '', import_iso: '', export_iso: '', note_open: '', note_interne: '',
  email: '', email2: '', email3: '', email4: '', email5: '',
  okpartners: 'S' as SN, blocca: 'N' as SN,
});

function snBool(field: 'okpartners' | 'blocca') {
  return computed<boolean>({
    get: () => form[field] === 'S',
    set: (v: boolean) => {
      form[field] = v ? 'S' : 'N';
    },
  });
}
const okpartnersBool = snBool('okpartners');
const blockaBool = snBool('blocca');

function resetForm() {
  Object.assign(form, {
    nome: '', import_iso: '', export_iso: '', note_open: '', note_interne: '',
    email: '', email2: '', email3: '', email4: '', email5: '',
    okpartners: 'S', blocca: 'N',
  });
  partnerModel.value = null;
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CustomsAgency) {
  editId.value = row.id;
  partnerModel.value = row.id_anagr_titolare;
  Object.assign(form, {
    nome: row.nome ?? '',
    import_iso: (row.import_iso ?? '').trim(),
    export_iso: (row.export_iso ?? '').trim(),
    note_open: row.note_open ?? '',
    note_interne: row.note_interne ?? '',
    email: row.email ?? '',
    email2: row.email2 ?? '',
    email3: row.email3 ?? '',
    email4: row.email4 ?? '',
    email5: row.email5 ?? '',
    okpartners: row.okpartners,
    blocca: row.blocca,
  });
  dialogOpen.value = true;
}

function rowActions(row: CustomsAgency): RowAction[] {
  return [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
    { key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) },
  ];
}

async function doSave() {
  if (!partnerModel.value) {
    toast.error(t('customs_agencies.partner_required'));
    return;
  }
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload: CustomsAgencyPayload = {
      id_anagr_titolare: partnerModel.value,
      nome: form.nome.trim(),
      import_iso: form.import_iso,
      export_iso: form.export_iso,
      note_open: form.note_open,
      note_interne: form.note_interne,
      email: form.email.trim(),
      email2: form.email2.trim(),
      email3: form.email3.trim(),
      email4: form.email4.trim(),
      email5: form.email5.trim(),
      okpartners: form.okpartners,
      blocca: form.blocca,
    };
    if (editId.value === null) {
      await customsAgenciesService.create(payload);
    } else {
      await customsAgenciesService.update(editId.value, payload);
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

async function removeRow(row: CustomsAgency) {
  const ok = await confirm.askDanger(
    t('customs_agencies.delete_confirm', { nome: row.nome ?? '' }),
    t('customs_agencies.delete_title'),
  );
  if (!ok) return;
  try {
    await customsAgenciesService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.ca-table :deep(th) { font-weight: 600; white-space: nowrap; }
.ca-section-label {
  font-size: var(--cm-fs-sm, 0.8125rem); font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.ca-hint {
  font-size: var(--cm-fs-xs, 0.75rem);
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 8px;
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
.ca-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.ca-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.ca-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
