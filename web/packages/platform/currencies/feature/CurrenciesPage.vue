<template>
  <div>
    <CmSectionHeader :title="t('sections.currencies')" :subtitle="t('currencies.subtitle')" />

    <v-alert type="info" variant="tonal" density="compact" class="mb-4">
      {{ t('currencies.cron_notice') }}
    </v-alert>

    <CmAsyncSection
      :loading="loading"
      :error="error"
      :empty="!loading && !error && rows.length === 0"
      :data="rows"
      loading-type="skeleton"
      :skeleton-rows="8"
      :skeleton-cols="6"
      @clear-error="error = null"
    >
      <template #empty>
        <CmEmptyState :icon="mdiCurrencyUsd" :title="t('currencies.empty')" />
      </template>

      <template #default>
        <v-card variant="outlined">
          <v-table density="compact" class="cur-table cm-table-zebra">
            <thead>
              <tr>
                <th style="width:90px">{{ t('currencies.sigla') }}</th>
                <th>{{ t('currencies.nome') }}</th>
                <th class="text-center" style="width:100px">{{ t('currencies.dogana') }}</th>
                <th class="text-center" style="width:90px" :title="t('currencies.assicurazione_hint')">{{ t('currencies.assicurazione') }}</th>
                <th class="text-center" style="width:90px" :title="t('currencies.contrassegno_hint')">{{ t('currencies.contrassegno') }}</th>
                <th class="text-right" style="width:110px" :title="t('currencies.cambio_readonly_hint')">{{ t('currencies.cambio') }}</th>
                <th class="text-center" style="width:140px">{{ t('currencies.data_cron') }}</th>
                <th class="text-center" style="width:80px">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <template v-if="editId === row.id">
                  <td>
                    <v-text-field
                      v-model="editForm.sigla"
                      density="compact" hide-details variant="outlined"
                      maxlength="4" class="text-uppercase"
                      @update:model-value="(v: string) => (editForm.sigla = v.toUpperCase())"
                    />
                  </td>
                  <td>
                    <v-text-field v-model="editForm.nome" density="compact" hide-details variant="outlined" maxlength="30" />
                  </td>
                  <td class="text-center">
                    <v-select
                      v-model="editForm.dogana"
                      :items="flagItems" item-title="title" item-value="value"
                      density="compact" hide-details variant="outlined"
                    />
                  </td>
                  <td class="text-center"><FlagIcon :value="row.assicurazione" /></td>
                  <td class="text-center"><FlagIcon :value="row.contrassegno" /></td>
                  <td class="text-right">{{ formatRate(row.cambioEUR) }}</td>
                  <td class="text-center text-caption">{{ formatDate(row.data_Cron) }}</td>
                  <td class="text-center">
                    <v-btn :icon="mdiCheck" size="x-small" variant="text" color="success" :loading="saving" @click="doSave(row.id)" />
                    <v-btn :icon="mdiClose" size="x-small" variant="text" @click="cancelEdit" />
                  </td>
                </template>
                <template v-else>
                  <td><b>{{ row.sigla }}</b></td>
                  <td>{{ row.nome }}</td>
                  <td class="text-center"><FlagIcon :value="row.dogana" /></td>
                  <td class="text-center"><FlagIcon :value="row.assicurazione" /></td>
                  <td class="text-center"><FlagIcon :value="row.contrassegno" /></td>
                  <td class="text-right">{{ formatRate(row.cambioEUR) }}</td>
                  <td class="text-center text-caption">{{ formatDate(row.data_Cron) }}</td>
                  <td class="text-center">
                    <v-btn :icon="mdiPencil" size="x-small" variant="text" @click="startEdit(row)" />
                  </td>
                </template>
              </tr>
            </tbody>
          </v-table>
          <div class="d-flex align-center justify-end pa-2">
            <span class="text-caption">{{ t('currencies.total', { n: rows.length }) }}</span>
          </div>
        </v-card>
      </template>
    </CmAsyncSection>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h, onMounted, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  mdiCurrencyUsd, mdiPencil, mdiCheck, mdiClose, mdiCheckCircle, mdiCircleOutline,
} from '@mdi/js';
import CmSectionHeader from '../../anagrafiche/components/CmSectionHeader.vue';
import CmAsyncSection from '../../anagrafiche/components/CmAsyncSection.vue';
import CmEmptyState from '../../anagrafiche/components/CmEmptyState.vue';
import { useToastStore } from '../../anagrafiche/stores/toast.store';
import { currenciesService, type Currency } from '../services/currencies.service';

const { t } = useI18n();
const toast = useToastStore();

const FlagIcon = defineComponent({
  props: { value: { type: String, default: 'N' } },
  setup(props) {
    return () =>
      h('i', {
        class: 'v-icon notranslate v-icon--size-default',
        style: `color:${props.value === 'S' ? '#2e7d32' : '#bdbdbd'}`,
      }, [
        h('svg', { viewBox: '0 0 24 24', style: 'width:18px;height:18px;fill:currentColor' }, [
          h('path', { d: props.value === 'S' ? mdiCheckCircle : mdiCircleOutline }),
        ]),
      ]);
  },
});

const rows = ref<Currency[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

const flagItems = [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
];

function formatRate(v: number): string {
  return Number(v).toFixed(6);
}
function formatDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await currenciesService.list();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

// ── Edición inline: solo sigla/nome/dogana, igual que el legacy ──
const editId = ref<number | null>(null);
const editForm = reactive({ sigla: '', nome: '', dogana: 'N' as 'S' | 'N' });

function startEdit(row: Currency) {
  editId.value = row.id;
  Object.assign(editForm, { sigla: row.sigla, nome: row.nome, dogana: row.dogana });
}
function cancelEdit() {
  editId.value = null;
}

async function doSave(id: number) {
  if (!editForm.sigla.trim() || !editForm.nome.trim()) {
    toast.error(t('common.required'));
    return;
  }
  saving.value = true;
  try {
    await currenciesService.update(id, {
      sigla: editForm.sigla.trim().toUpperCase(),
      nome: editForm.nome.trim(),
      dogana: editForm.dogana,
    });
    toast.success(t('common.saved'));
    editId.value = null;
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.cur-table :deep(th) { font-weight: 600; white-space: nowrap; }
.cur-table :deep(tbody tr:nth-child(odd) > td) { background: rgb(var(--v-theme-surface)); }
.cur-table :deep(tbody tr:nth-child(even) > td) { background: rgba(var(--v-theme-on-surface), 0.05); }
.cur-table :deep(tbody tr:hover > td) { background: rgba(var(--v-theme-primary), 0.09) !important; }
</style>
