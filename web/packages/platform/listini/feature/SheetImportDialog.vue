<template>
  <v-dialog :model-value="modelValue" max-width="1100" persistent scrollable @update:model-value="onClose">
    <v-card>
      <v-card-title>{{ t('price_lists.sheet_title') }}</v-card-title>

      <v-card-text>
        <!-- Paso 1: pegar la hoja y elegir la versión -->
        <template v-if="step === 1">
          <v-alert type="info" variant="tonal" density="compact" class="mb-3">{{ t('price_lists.sheet_intro') }}</v-alert>
          <div class="d-flex align-center ga-3 mb-2">
            <v-btn size="small" variant="outlined" @click="pickFile">{{ t('price_lists.sheet_load_file') }}</v-btn>
            <span v-if="fileName" class="cm-cell-hint">{{ fileName }}</span>
            <input ref="fileInput" type="file" accept=".csv,.tsv,.txt" class="d-none" @change="onFile" />
          </div>
          <v-textarea
            v-model="sheet"
            :label="t('price_lists.sheet_paste')"
            rows="10"
            variant="outlined"
            density="compact"
            auto-grow
            class="cm-sheet-text"
            hide-details
          />

          <div class="cm-sec mt-4">{{ t('price_lists.sheet_target') }}</div>
          <v-radio-group v-model="target" density="compact" hide-details>
            <v-radio v-if="current" value="current" :label="t('price_lists.sheet_target_current', { from: day(current.data_start), to: day(current.data_stop) })" />
            <v-radio v-else value="current" :label="t('price_lists.sheet_target_first')" />
            <v-radio
              v-for="f in futures"
              :key="f.data_start"
              :value="'f:' + f.data_start + '|' + f.data_stop"
              :label="t('price_lists.sheet_target_future', { from: day(f.data_start), to: day(f.data_stop) })"
            />
            <v-radio value="new" :label="t('price_lists.sheet_target_new')" />
          </v-radio-group>
          <v-text-field
            v-if="target === 'new'"
            v-model="newDate"
            type="date"
            :min="tomorrow"
            :label="t('price_lists.effective_from')"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 220px"
          />
        </template>

        <!-- Paso 2: lo que se ha interpretado -->
        <template v-else-if="step === 2 && result">
          <v-alert v-if="!result.ok" type="error" variant="tonal" class="mb-3">
            <div class="font-weight-medium mb-1">{{ t('price_lists.sheet_errors_title') }}</div>
            <ul class="pl-4">
              <li v-for="(e, i) in result.errors" :key="i">{{ e }}</li>
            </ul>
            <div class="mt-2 cm-cell-hint">{{ t('price_lists.sheet_errors_hint') }}</div>
          </v-alert>
          <v-alert v-else type="success" variant="tonal" class="mb-3">{{ t('price_lists.sheet_ok', { window: windowText }) }}</v-alert>

          <div class="cm-sec">{{ t('price_lists.tab_supplements') }}</div>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>{{ t('price_lists.supplement') }}</th>
                <th v-for="c in SUPPL_COLS" :key="c.key" class="text-right">{{ t(c.label) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in result.suppl" :key="s.id">
                <td>{{ s.nome }}</td>
                <td v-for="c in SUPPL_COLS" :key="c.key" class="text-right">{{ Number(s[c.key]) === 0 ? '' : s[c.key] }}</td>
              </tr>
            </tbody>
          </v-table>

          <template v-if="result.ext">
            <div class="cm-sec">{{ t('price_lists.ext_title') }}</div>
            <SheetGrid :rows="[result.ext]" :result="result" class="mb-4" />
          </template>
          <template v-if="result.scagl.length">
            <div class="cm-sec">{{ t('price_lists.tab_prices') }}</div>
            <SheetGrid :rows="result.scagl" :result="result" />
          </template>
        </template>

        <!-- Paso 3: resultado -->
        <template v-else-if="step === 3">
          <div class="py-6 text-center">
            <v-icon :icon="mdiCheckCircle" color="success" size="48" class="mb-2" />
            <p class="text-h6 mb-1">{{ applied?.operazione }}</p>
            <p class="text-body-2 text-medium-emphasis">{{ t('price_lists.sheet_done', { n: applied?.rows_inserted ?? 0 }) }}</p>
          </div>
        </template>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">{{ error }}</v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="busy" @click="onClose(false)">{{ step === 3 ? t('common.close') : t('common.cancel') }}</v-btn>
        <v-btn v-if="step === 2" variant="text" :disabled="busy" @click="step = 1">{{ t('price_lists.bulk_back') }}</v-btn>
        <v-btn v-if="step === 1" color="primary" :loading="busy" :disabled="!sheet.trim() || (target === 'new' && !newDate)" @click="validate">
          {{ t('price_lists.sheet_validate') }}
        </v-btn>
        <v-btn v-else-if="step === 2" color="primary" :loading="busy" :disabled="!result?.ok" @click="apply">
          {{ t('price_lists.sheet_apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Hoja de gestión del listino (paridad listy_gestnew): se exporta, se edita en
 * Excel, se pega aquí, se valida (CT01-CT17, ZN00, BN01, DP01…) y se confirma.
 * El servidor valida dos veces: al previsualizar y al aplicar.
 */
import { ref, computed, watch, h, defineComponent, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheckCircle } from '@mdi/js';
import { listiniService, type ListinoVersion, type SheetInterpretation, type SheetRow } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean; packId: number | null; versions: ListinoVersion[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; applied: [] }>();

const { t } = useI18n();

const SUPPL_COLS = [
  { key: 'costo_fisso', label: 'price_lists.fixed' },
  { key: 'costo_min', label: 'price_lists.suppl_min' },
  { key: 'costo_max', label: 'price_lists.suppl_max' },
  { key: 'costo_kg', label: 'price_lists.per_kg' },
  { key: 'costo_collo', label: 'price_lists.suppl_per_collo' },
  { key: 'costo_gg', label: 'price_lists.suppl_per_day' },
  { key: 'costo_perc', label: 'price_lists.suppl_percent' },
];

const step = ref<1 | 2 | 3>(1);
const sheet = ref('');
const fileName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const target = ref('current');
const newDate = ref('');
const busy = ref(false);
const error = ref('');
const result = ref<SheetInterpretation | null>(null);
const applied = ref<{ operazione: string; rows_inserted: number } | null>(null);

const current = computed(() => props.versions.find((v) => v.estado === 'in_corso') ?? null);
const futures = computed(() => props.versions.filter((v) => v.estado === 'futuro'));
const tomorrow = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
});

function day(d: string): string {
  return d && !d.startsWith('0000') ? d.slice(0, 10) : '…';
}

/** start/stop que entiende classify() (casos 1-5 del legacy). */
function dates(): { start: string; stop: string } {
  if (target.value === 'new') return { start: newDate.value, stop: '' };
  if (target.value.startsWith('f:')) {
    const [s, e] = target.value.slice(2).split('|');
    return { start: s.slice(0, 10), stop: e.slice(0, 10) };
  }
  if (current.value) return { start: current.value.data_start.slice(0, 10), stop: current.value.data_stop.slice(0, 10) };
  return { start: new Date().toISOString().slice(0, 10), stop: '' };
}

const windowText = computed(() => {
  const d = dates();
  return `${d.start || '…'} → ${d.stop || '2050-12-31'}`;
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    step.value = 1;
    sheet.value = '';
    fileName.value = '';
    target.value = 'current';
    newDate.value = '';
    error.value = '';
    result.value = null;
    applied.value = null;
  },
);

function pickFile(): void {
  fileInput.value?.click();
}
function onFile(ev: Event): void {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  fileName.value = f.name;
  const reader = new FileReader();
  reader.onload = () => {
    sheet.value = String(reader.result ?? '').replace(/^﻿/, '');
  };
  reader.readAsText(f, 'utf-8');
}

async function validate(): Promise<void> {
  if (!props.packId) return;
  busy.value = true;
  error.value = '';
  try {
    result.value = await listiniService.sheetValidate(props.packId, sheet.value);
    step.value = 2;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function apply(): Promise<void> {
  if (!props.packId) return;
  busy.value = true;
  error.value = '';
  try {
    const d = dates();
    applied.value = await listiniService.sheetApply(props.packId, sheet.value, d.start, d.stop);
    step.value = 3;
    emit('applied');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function onClose(v: boolean): void {
  if (busy.value) return;
  emit('update:modelValue', v);
}

/** Tabla de escalones / peso extra con las celdas erróneas en rojo. */
const SheetGrid = defineComponent({
  props: {
    rows: { type: Array as PropType<SheetRow[]>, required: true },
    result: { type: Object as PropType<SheetInterpretation>, required: true },
  },
  setup(p) {
    const bad = { background: 'rgba(244,67,54,0.25)' };
    return () => {
      const r = p.result;
      const cols: string[] = [];
      for (const z of r.zones) {
        cols.push('prezzo');
        if (r.flags.collo2) cols.push('prezzo2');
        if (r.flags.base) cols.push('prezzo_base');
        if (r.flags.min) cols.push('prezzo_min');
      }
      const zoneHead = r.zones.map((z) =>
        h('th', { colspan: cols.length / Math.max(1, r.zones.length), class: 'text-center' }, `${r.labels.zone} ${z === '-1' ? 'B1' : z}`),
      );
      const per = cols.length / Math.max(1, r.zones.length);
      const body = p.rows.map((row) => {
        const tds = [h('td', { style: row.first_ok ? {} : bad }, row.first)];
        if (r.flags.num_bnc) tds.push(h('td', {}, String(row.num ?? '')));
        r.zones.forEach((z) => {
          const keys = cols.slice(0, per);
          keys.forEach((k) => {
            const c = row.cells[z]?.[k];
            tds.push(h('td', { class: 'text-right', style: c && !c.ok ? bad : {} }, c ? c.value : ''));
          });
        });
        return h('tr', {}, tds);
      });
      return h('div', { style: 'overflow:auto' }, [
        h('table', { class: 'cm-sheet-grid' }, [
          h('thead', {}, [h('tr', {}, [h('th', {}, r.labels.peso), ...(r.flags.num_bnc ? [h('th', {}, 'Q.ta')] : []), ...zoneHead])]),
          h('tbody', {}, body),
        ]),
      ]);
    };
  },
});
</script>

<style scoped>
.cm-sec {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.7;
  margin: 4px 0 8px;
}
.cm-sheet-text :deep(textarea) {
  font-family: var(--cm-font-mono, monospace);
  font-size: 12px;
  white-space: pre;
}
:deep(.cm-sheet-grid) {
  border-collapse: collapse;
  font-size: 12px;
}
:deep(.cm-sheet-grid th),
:deep(.cm-sheet-grid td) {
  border: 1px solid rgba(128, 128, 128, 0.25);
  padding: 3px 8px;
}
</style>
