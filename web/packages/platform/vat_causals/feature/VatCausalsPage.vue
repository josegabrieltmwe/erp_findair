<template>
  <div>
    <CmSectionHeader :title="t('sections.vat_causals')" :subtitle="t('vat_causals.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('vat_causals.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('vat_causals.new') }}
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
      :skeleton-cols="5"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiReceiptTextOutline" :title="t('vat_causals.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="vc-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:80px">{{ t('vat_causals.ordine') }}</th>
                <th style="width:90px">{{ t('vat_causals.tipo') }}</th>
                <th>{{ t('vat_causals.descr') }}</th>
                <th>{{ t('vat_causals.descr_en') }}</th>
                <th class="text-center" style="width:100px">{{ t('vat_causals.stato') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td class="text-center">{{ row.ordine }}</td>
                <td><b>{{ row.tipo }}</b></td>
                <td>{{ row.descr }}</td>
                <td class="text-medium-emphasis">{{ row.descrEN || '—' }}</td>
                <td class="text-center">
                  <v-chip size="x-small" :color="row.stato === 'A' ? 'success' : 'default'" variant="tonal">
                    {{ row.stato === 'A' ? t('vat_causals.stato_a') : t('vat_causals.stato_o') }}
                  </v-chip>
                </td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('vat_causals.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="560" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiReceiptTextOutline" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('vat_causals.new') : t('vat_causals.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.tipo"
                  :label="t('vat_causals.tipo')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="5"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model.number="form.ordine"
                  :label="t('vat_causals.ordine')"
                  type="number"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="12">
                <v-text-field
                  v-model="form.descr"
                  :label="t('vat_causals.descr')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="12">
                <v-text-field
                  v-model="form.descrEN"
                  :label="t('vat_causals.descr_en')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="12">
                <v-text-field
                  v-model="form.nota_uso"
                  :label="t('vat_causals.nota_uso')"
                  variant="outlined" density="comfortable" maxlength="250"
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
import { mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiReceiptTextOutline, mdiClose, mdiContentSave } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import { clientCausalsService, type ClientCausal } from '../../anagrafiche/services/clientCausals.service';

/**
 * Administración del catálogo GLOBAL de causali IVA (`fatture_causali_clienti`,
 * 12 filas). Réplica moderna de `anagr_causali_iva.php`. NO confundir con la
 * asignación de la causale por defecto de un cliente concreto — esa vive en
 * la ficha de cliente (`AnagraficaCausaliIvaSection.vue`, misma tabla, mismo
 * servicio `clientCausalsService`, pero llamando a `assign()` en vez de
 * administrar el catálogo). Ver Client_Causals_Controller (backend) para el
 * porqué de este reparto.
 */

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<ClientCausal[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) =>
      (r.tipo ?? '').toLowerCase().includes(q) ||
      (r.descr ?? '').toLowerCase().includes(q) ||
      (r.descrEN ?? '').toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    // Sin id_anagrafica: catálogo completo, sin marca `predefinita`.
    rows.value = await clientCausalsService.list(0);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({ tipo: '', ordine: 0, descr: '', descrEN: '', nota_uso: '' });
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { tipo: '', ordine: 0, descr: '', descrEN: '', nota_uso: '' });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ClientCausal) {
  editId.value = row.id;
  Object.assign(form, {
    tipo: row.tipo ?? '',
    ordine: row.ordine ?? 0,
    descr: row.descr ?? '',
    descrEN: row.descrEN ?? '',
    nota_uso: row.nota_uso ?? '',
  });
  dialogOpen.value = true;
}

function rowActions(row: ClientCausal): RowAction[] {
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
      tipo: form.tipo.trim(),
      ordine: Number(form.ordine) || 0,
      descr: form.descr.trim(),
      descrEN: form.descrEN.trim(),
      nota_uso: form.nota_uso.trim(),
    };
    if (editId.value === null) {
      await clientCausalsService.create(0, payload);
    } else {
      await clientCausalsService.update(editId.value, payload);
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

async function removeRow(row: ClientCausal) {
  const ok = await confirm.askDanger(
    t('vat_causals.delete_confirm', { descr: row.descr ?? '' }),
    t('vat_causals.delete_title'),
  );
  if (!ok) return;
  try {
    await clientCausalsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.vc-table :deep(th) { font-weight: 600; white-space: nowrap; }
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
.vc-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.vc-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.vc-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
