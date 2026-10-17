<template>
  <div>
    <CmSectionHeader :title="t('sections.cargo_carriers')" :subtitle="t('cargo_carriers.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('cargo_carriers.search')"
          density="compact" hide-details clearable
          style="max-width: 260px"
        />
        <v-select
          v-model="filterTipo"
          :items="tipoFilterItems"
          item-title="title" item-value="value"
          :label="t('cargo_carriers.filter_tipo')"
          density="compact" variant="outlined" hide-details clearable
          style="max-width: 200px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('cargo_carriers.new') }}
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
        <CmEmptyState :icon="mdiAirplane" :title="t('cargo_carriers.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cc-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:90px">{{ t('cargo_carriers.sigla') }}</th>
                <th>{{ t('cargo_carriers.nome_orig') }}</th>
                <th style="width:80px">{{ t('cargo_carriers.tipo') }}</th>
                <th class="text-center" style="width:80px">{{ t('cargo_carriers.ignora') }}</th>
                <th class="text-center" style="width:90px">{{ t('cargo_carriers.vista') }}</th>
                <th class="text-center" style="width:110px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filtered" :key="row.id">
                <td><b>{{ row.sigla }}</b></td>
                <td>{{ row.nome_orig }}</td>
                <td>{{ row.tipo === 'A' ? t('cargo_carriers.tipo_a') : t('cargo_carriers.tipo_s') }}</td>
                <td class="text-center"><FlagIcon :value="row.ignora" warn /></td>
                <td class="text-center"><FlagIcon :value="row.vista" /></td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('cargo_carriers.total', { n: filtered.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="640" persistent>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiAirplane" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('cargo_carriers.new') : t('cargo_carriers.edit') }}</span>
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
                  :label="t('cargo_carriers.sigla')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="15"
                  class="text-uppercase"
                  @update:model-value="(v: string) => (form.sigla = v.toUpperCase())"
                />
              </v-col>
              <v-col cols="12" sm="8">
                <v-text-field
                  v-model="form.nome_orig"
                  :label="t('cargo_carriers.nome_orig')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="50"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.nome"
                  :label="t('cargo_carriers.nome')"
                  variant="outlined" density="comfortable" maxlength="50"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  item-title="title" item-value="value"
                  :label="t('cargo_carriers.tipo')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
            </v-row>

            <p class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('cargo_carriers.flags_section') }}</p>
            <v-row dense>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.logo" true-value="S" false-value="N" :label="t('cargo_carriers.logo')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.vista" true-value="S" false-value="N" :label="t('cargo_carriers.vista')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.rated_agreed" true-value="S" false-value="N" :label="t('cargo_carriers.rated_agreed')" density="compact" hide-details color="primary" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.ignora" true-value="S" false-value="N" :label="t('cargo_carriers.ignora')" :hint="t('cargo_carriers.ignora_hint')" persistent-hint density="compact" color="error" />
              </v-col>
              <v-col cols="6" sm="3">
                <v-switch v-model="form.ignora_b2b" true-value="S" false-value="N" :label="t('cargo_carriers.ignora_b2b')" :hint="t('cargo_carriers.ignora_b2b_hint')" persistent-hint density="compact" color="warning" />
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
import { ref, reactive, computed, h, onMounted, defineComponent, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiPlus, mdiPencil, mdiMagnify, mdiDelete, mdiAirplane, mdiClose, mdiContentSave,
  mdiCheckCircle, mdiCircleOutline, mdiAlertCircle,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  cargoCarriersService,
  type CargoCarrier,
  type CarrierTipo,
  type Flag,
} from '../services/cargoCarriers.service';

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

const rows = ref<CargoCarrier[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const search = ref('');
const filterTipo = ref<CarrierTipo | null>(null);

const tipoItems = [
  { title: t('cargo_carriers.tipo_a'), value: 'A' },
  { title: t('cargo_carriers.tipo_s'), value: 'S' },
];
const tipoFilterItems = tipoItems;

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter(
    (r) => r.sigla.toLowerCase().includes(q) || r.nome_orig.toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await cargoCarriersService.list(filterTipo.value ?? undefined);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch(filterTipo, load);

const dialogOpen = ref(false);
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);
const editId = ref<number | null>(null);
const form = reactive({
  sigla: '', nome_orig: '', nome: '', tipo: 'A' as CarrierTipo,
  logo: 'N' as Flag, vista: 'N' as Flag, rated_agreed: 'N' as Flag,
  ignora: 'N' as Flag, ignora_b2b: 'N' as Flag,
});
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, {
    sigla: '', nome_orig: '', nome: '', tipo: 'A',
    logo: 'N', vista: 'N', rated_agreed: 'N', ignora: 'N', ignora_b2b: 'N',
  });
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: CargoCarrier) {
  editId.value = row.id;
  Object.assign(form, {
    sigla: row.sigla, nome_orig: row.nome_orig, nome: row.nome ?? '', tipo: row.tipo,
    logo: row.logo, vista: row.vista, rated_agreed: row.rated_agreed,
    ignora: row.ignora, ignora_b2b: row.ignora_b2b,
  });
  dialogOpen.value = true;
}

function rowActions(row: CargoCarrier): RowAction[] {
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
      nome_orig: form.nome_orig.trim(),
      nome: form.nome.trim(),
      tipo: form.tipo,
      logo: form.logo,
      vista: form.vista,
      rated_agreed: form.rated_agreed,
      ignora: form.ignora,
      ignora_b2b: form.ignora_b2b,
    };
    if (editId.value === null) {
      await cargoCarriersService.create(payload);
    } else {
      await cargoCarriersService.update(editId.value, payload);
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

async function removeRow(row: CargoCarrier) {
  const ok = await confirm.askDanger(
    t('cargo_carriers.delete_confirm', { sigla: row.sigla }),
    t('cargo_carriers.delete_title'),
  );
  if (!ok) return;
  try {
    await cargoCarriersService.remove(row.id);
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
