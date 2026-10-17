<template>
  <div>
    <CmSectionHeader :title="t('sections.profit_presets')" :subtitle="t('profit_presets.subtitle')" />

    <v-card class="pa-4 mb-4" variant="outlined">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center">
        <v-select
          v-model="filterTipo"
          :items="tipoFilterItems"
          item-title="title" item-value="value"
          :label="t('profit_presets.filter_tipo')"
          density="compact" variant="outlined" hide-details clearable
          style="max-width: 220px"
        />
        <v-spacer />
        <v-btn class="cm-btn-accent" variant="flat" :prepend-icon="mdiPlus" @click="openCreate">
          {{ t('profit_presets.new') }}
        </v-btn>
      </div>
    </v-card>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="6"
      :skeleton-cols="6"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiChartLine" :title="t('profit_presets.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="pp-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:90px">{{ t('profit_presets.tipo') }}</th>
                <th>{{ t('profit_presets.nome') }}</th>
                <th class="text-center" style="width:90px">{{ t('profit_presets.base') }}</th>
                <th class="text-center" style="width:100px" :title="t('profit_presets.usage_hint')">{{ t('profit_presets.usage') }}</th>
                <th class="text-center" style="width:120px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ tipoLabel(row.tipo) }}</td>
                <td><b>{{ row.nome }}</b></td>
                <td class="text-center">
                  <v-icon v-if="row.base === 'S'" :icon="mdiCheckCircle" color="success" size="18" />
                </td>
                <td class="text-center">{{ row.usage_count }}</td>
                <td class="text-center">
                  <CmRowActions :actions="rowActions(row)" />
                </td>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('profit_presets.total', { n: rows.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>

    <v-dialog v-model="dialogOpen" max-width="720" persistent scrollable>
      <v-card rounded="lg">
        <div class="cm-dialog-head">
          <v-icon :icon="mdiChartLine" class="cm-dialog-head__icon" />
          <span class="cm-dialog-head__title">{{ editId === null ? t('profit_presets.new') : t('profit_presets.edit') }}</span>
          <v-spacer />
          <v-btn :icon="mdiClose" variant="text" size="small" @click="dialogOpen = false" />
        </div>
        <v-divider />

        <v-form ref="formRef" @submit.prevent="doSave">
          <v-card-text class="pt-5">
            <v-row dense>
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.tipo"
                  :items="tipoItems"
                  item-title="title" item-value="value"
                  :label="t('profit_presets.tipo')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="8">
                <v-text-field
                  v-model="form.nome"
                  :label="t('profit_presets.nome')"
                  :rules="[requiredRule]"
                  variant="outlined" density="comfortable" maxlength="50"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model.number="form.ass_min"
                  :label="t('profit_presets.ass_min')"
                  type="number" step="0.01" min="0"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field
                  v-model.number="form.ass_perc"
                  :label="t('profit_presets.ass_perc')"
                  type="number" step="0.01" min="0"
                  suffix="%"
                  variant="outlined" density="comfortable"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.note"
                  :label="t('profit_presets.note')"
                  variant="outlined" density="comfortable"
                />
              </v-col>
            </v-row>

            <div class="d-flex align-center justify-space-between mt-2 mb-1">
              <p class="text-caption text-medium-emphasis mb-0">{{ t('profit_presets.tiers_hint') }}</p>
              <v-text-field
                v-model="marginCurrency"
                :label="t('profit_presets.currency')"
                density="compact" hide-details variant="outlined"
                style="max-width: 100px" maxlength="3"
              />
            </div>
            <v-table density="compact" class="pp-tiers-table">
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th>{{ t('profit_presets.tier_kg') }}</th>
                  <th style="width:64px"></th>
                  <th>{{ t('profit_presets.tier_pr') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="n in 10" :key="n">
                  <td class="text-medium-emphasis">{{ n }}</td>
                  <td>
                    <v-text-field
                      v-model.number="tiers[n - 1].kg"
                      type="number" step="0.01" min="0"
                      density="compact" hide-details variant="outlined"
                    />
                  </td>
                  <td>
                    <v-select
                      :model-value="tiers[n - 1].mt"
                      :items="[{ title: '%', value: 'P' }, { title: '€', value: 'F' }]"
                      density="compact" hide-details variant="outlined"
                      @update:model-value="(v) => (tiers[n - 1].mt = v as 'P' | 'F')"
                    />
                  </td>
                  <td>
                    <v-text-field
                      v-if="tiers[n - 1].mt === 'F'"
                      v-model.number="tiers[n - 1].fx"
                      type="number" step="0.01" min="0"
                      :suffix="marginCurrency"
                      :label="t('profit_presets.tier_fx')"
                      density="compact" hide-details variant="outlined"
                    />
                    <v-text-field
                      v-else
                      v-model.number="tiers[n - 1].pr"
                      type="number" step="0.01" min="0"
                      suffix="%"
                      density="compact" hide-details variant="outlined"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
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
import { ref, reactive, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus, mdiPencil, mdiDelete, mdiChartLine, mdiClose, mdiContentSave, mdiCheckCircle } from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmRowActions, { type RowAction } from '../../anagrafiche/components/CmRowActions.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { useConfirm } from '../../anagrafiche/composables/useConfirm';
import {
  profitPresetsService,
  type ProfitPreset,
  type PresetTipo,
  type ProfitPresetPayload,
} from '../services/profitPresets.service';

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const rows = ref<ProfitPreset[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const filterTipo = ref<PresetTipo | null>(null);

const tipoItems = [
  { title: t('profit_presets.tipo_e'), value: 'E' },
  { title: t('profit_presets.tipo_a'), value: 'A' },
  { title: t('profit_presets.tipo_s'), value: 'S' },
];
const tipoFilterItems = tipoItems;

function tipoLabel(v: PresetTipo): string {
  return tipoItems.find((i) => i.value === v)?.title ?? v;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await profitPresetsService.list(filterTipo.value ?? undefined);
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
  tipo: 'E' as PresetTipo, nome: '', ass_perc: 0, ass_min: 0, note: '',
});
const tiers = reactive(Array.from({ length: 10 }, () => ({ kg: 0, pr: 0, mt: 'P' as 'P' | 'F', fx: 0 })));
const marginCurrency = ref('EUR');
const requiredRule = (v: unknown) => (!!v && String(v).trim() !== '') || t('common.required');

function resetForm() {
  Object.assign(form, { tipo: 'E', nome: '', ass_perc: 0, ass_min: 0, note: '' });
  tiers.forEach((t_) => { t_.kg = 0; t_.pr = 0; t_.mt = 'P'; t_.fx = 0; });
  marginCurrency.value = 'EUR';
}
function openCreate() {
  editId.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(row: ProfitPreset) {
  editId.value = row.id;
  Object.assign(form, {
    tipo: row.tipo, nome: row.nome, ass_perc: row.ass_perc, ass_min: row.ass_min,
    note: row.note ?? '',
  });
  tiers[0].kg = row.kg01; tiers[0].pr = row.pr01; tiers[0].mt = row.mt01 ?? 'P'; tiers[0].fx = row.fx01 ?? 0;
  tiers[1].kg = row.kg02; tiers[1].pr = row.pr02; tiers[1].mt = row.mt02 ?? 'P'; tiers[1].fx = row.fx02 ?? 0;
  tiers[2].kg = row.kg03; tiers[2].pr = row.pr03; tiers[2].mt = row.mt03 ?? 'P'; tiers[2].fx = row.fx03 ?? 0;
  tiers[3].kg = row.kg04; tiers[3].pr = row.pr04; tiers[3].mt = row.mt04 ?? 'P'; tiers[3].fx = row.fx04 ?? 0;
  tiers[4].kg = row.kg05; tiers[4].pr = row.pr05; tiers[4].mt = row.mt05 ?? 'P'; tiers[4].fx = row.fx05 ?? 0;
  tiers[5].kg = row.kg06; tiers[5].pr = row.pr06; tiers[5].mt = row.mt06 ?? 'P'; tiers[5].fx = row.fx06 ?? 0;
  tiers[6].kg = row.kg07; tiers[6].pr = row.pr07; tiers[6].mt = row.mt07 ?? 'P'; tiers[6].fx = row.fx07 ?? 0;
  tiers[7].kg = row.kg08; tiers[7].pr = row.pr08; tiers[7].mt = row.mt08 ?? 'P'; tiers[7].fx = row.fx08 ?? 0;
  tiers[8].kg = row.kg09; tiers[8].pr = row.pr09; tiers[8].mt = row.mt09 ?? 'P'; tiers[8].fx = row.fx09 ?? 0;
  tiers[9].kg = row.kg10; tiers[9].pr = row.pr10; tiers[9].mt = row.mt10 ?? 'P'; tiers[9].fx = row.fx10 ?? 0;
  marginCurrency.value = row.margin_currency ?? 'EUR';
  dialogOpen.value = true;
}

function rowActions(row: ProfitPreset): RowAction[] {
  const actions: RowAction[] = [
    { key: 'edit', title: t('common.edit'), icon: mdiPencil, onClick: () => openEdit(row) },
  ];
  if (row.base !== 'S') {
    actions.push({ key: 'delete', title: t('common.delete'), icon: mdiDelete, color: 'error', onClick: () => removeRow(row) });
  }
  return actions;
}

function buildPayload(): ProfitPresetPayload {
  const t_ = tiers;
  return {
    tipo: form.tipo,
    nome: form.nome.trim(),
    ass_perc: Number(form.ass_perc) || 0,
    ass_min: Number(form.ass_min) || 0,
    note: form.note.trim(),
    margin_currency: marginCurrency.value || 'EUR',
    kg01: Number(t_[0].kg) || 0, pr01: Number(t_[0].pr) || 0, mt01: t_[0].mt, fx01: Number(t_[0].fx) || 0,
    kg02: Number(t_[1].kg) || 0, pr02: Number(t_[1].pr) || 0, mt02: t_[1].mt, fx02: Number(t_[1].fx) || 0,
    kg03: Number(t_[2].kg) || 0, pr03: Number(t_[2].pr) || 0, mt03: t_[2].mt, fx03: Number(t_[2].fx) || 0,
    kg04: Number(t_[3].kg) || 0, pr04: Number(t_[3].pr) || 0, mt04: t_[3].mt, fx04: Number(t_[3].fx) || 0,
    kg05: Number(t_[4].kg) || 0, pr05: Number(t_[4].pr) || 0, mt05: t_[4].mt, fx05: Number(t_[4].fx) || 0,
    kg06: Number(t_[5].kg) || 0, pr06: Number(t_[5].pr) || 0, mt06: t_[5].mt, fx06: Number(t_[5].fx) || 0,
    kg07: Number(t_[6].kg) || 0, pr07: Number(t_[6].pr) || 0, mt07: t_[6].mt, fx07: Number(t_[6].fx) || 0,
    kg08: Number(t_[7].kg) || 0, pr08: Number(t_[7].pr) || 0, mt08: t_[7].mt, fx08: Number(t_[7].fx) || 0,
    kg09: Number(t_[8].kg) || 0, pr09: Number(t_[8].pr) || 0, mt09: t_[8].mt, fx09: Number(t_[8].fx) || 0,
    kg10: Number(t_[9].kg) || 0, pr10: Number(t_[9].pr) || 0, mt10: t_[9].mt, fx10: Number(t_[9].fx) || 0,
  };
}

async function doSave() {
  const ok = await formRef.value?.validate();
  if (ok && !ok.valid) return;
  saving.value = true;
  try {
    const payload = buildPayload();
    if (editId.value === null) {
      await profitPresetsService.create(payload);
    } else {
      await profitPresetsService.update(editId.value, payload);
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

async function removeRow(row: ProfitPreset) {
  const ok = await confirm.askDanger(
    t('profit_presets.delete_confirm', { nome: row.nome }),
    t('profit_presets.delete_title'),
  );
  if (!ok) return;
  try {
    await profitPresetsService.remove(row.id);
    toast.success(t('common.deleted'));
    load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(load);
</script>

<style scoped>
.pp-table :deep(th) { font-weight: 600; white-space: nowrap; }
.pp-tiers-table :deep(th) { font-weight: 600; font-size: 12px; }
.pp-tiers-table :deep(td) { padding: 4px 8px !important; }
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
.pp-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.pp-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.pp-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
