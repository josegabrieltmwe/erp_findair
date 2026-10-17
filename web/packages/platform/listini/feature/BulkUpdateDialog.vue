<template>
  <v-dialog :model-value="modelValue" max-width="980" persistent scrollable @update:model-value="close">
    <v-card>
      <v-card-title>{{ t('price_lists.bulk_title', { n: listinoIds.length }) }}</v-card-title>

      <v-card-text>
        <!-- Paso 1: parámetros -->
        <template v-if="step === 'params'">
          <div class="cm-cell-hint mb-3">{{ t('price_lists.bulk_intro') }}</div>

          <div class="cm-sec">{{ t('price_lists.bulk_prices') }}</div>
          <div class="cm-grid mb-3">
            <v-text-field v-model="form.imp_zon" :label="t('price_lists.bulk_pct_zone')" suffix="%" density="compact" />
            <v-text-field v-model="form.imp_bas" :label="t('price_lists.bulk_pct_base')" suffix="%" density="compact" />
            <v-text-field v-model="form.imp_min" :label="t('price_lists.bulk_pct_min')" suffix="%" density="compact" />
          </div>

          <div class="cm-sec">{{ t('price_lists.bulk_supplements') }}</div>
          <v-radio-group v-model="form.opx_fix" inline density="compact" hide-details class="mb-2">
            <v-radio value="ALL" :label="t('price_lists.bulk_fix_all')" />
            <v-radio value="NEW" :label="t('price_lists.bulk_fix_new')" />
          </v-radio-group>
          <div class="cm-cell-hint mb-2">{{ t('price_lists.bulk_zero_hint') }}</div>

          <v-table density="compact" class="cm-bulk-table">
            <thead>
              <tr>
                <th>{{ t('price_lists.supplement') }}</th>
                <th v-for="c in COLUMNS" :key="c.key" class="text-center">
                  {{ t(c.label) }}
                  <v-select
                    v-model="form.oprz[c.key]"
                    :items="OPS"
                    density="compact"
                    variant="underlined"
                    hide-details
                    clearable
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in supplementTypes" :key="s.id">
                <td class="font-weight-medium">{{ s.nome }}</td>
                <td v-for="c in COLUMNS" :key="c.key" style="min-width: 84px">
                  <v-text-field
                    v-model="form.spp[c.key][s.id]"
                    density="compact"
                    variant="underlined"
                    hide-details
                    :disabled="!form.oprz[c.key]"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>

        <!-- Paso 2: confirmación -->
        <template v-else-if="step === 'confirm'">
          <v-alert type="warning" variant="tonal" class="mb-3">
            {{ t('price_lists.bulk_confirm', { n: listinoIds.length }) }}
          </v-alert>
          <ul class="cm-summary">
            <li v-if="form.imp_zon">{{ t('price_lists.bulk_pct_zone') }}: {{ form.imp_zon }}%</li>
            <li v-if="form.imp_bas">{{ t('price_lists.bulk_pct_base') }}: {{ form.imp_bas }}%</li>
            <li v-if="form.imp_min">{{ t('price_lists.bulk_pct_min') }}: {{ form.imp_min }}%</li>
            <li v-if="suppliesChanged">{{ t('price_lists.bulk_supplements') }}: {{ suppliesSummary }}</li>
          </ul>
          <div class="cm-cell-hint mt-3">{{ t('price_lists.bulk_undo_hint') }}</div>
        </template>

        <!-- Paso 3: ejecución -->
        <template v-else>
          <v-progress-linear
            :model-value="(done / Math.max(1, listinoIds.length)) * 100"
            :indeterminate="running && done === 0"
            class="mb-3"
            height="8"
            rounded
          />
          <div class="mb-2">
            {{ t('price_lists.bulk_progress', { done, total: listinoIds.length }) }}
            <span v-if="batch" class="cm-cell-hint"> · {{ batch }}</span>
          </div>
          <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
          <v-table v-if="results.length" density="compact">
            <thead>
              <tr>
                <th>{{ t('price_lists.col_name') }}</th>
                <th>{{ t('common.status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in results" :key="r.listino_id">
                <td>#{{ r.listino_id }}</td>
                <td>{{ resultLabel(r) }}</td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="step === 'params'">
          <v-btn variant="text" @click="close(false)">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!canContinue" @click="step = 'confirm'">
            {{ t('price_lists.bulk_continue') }}
          </v-btn>
        </template>
        <template v-else-if="step === 'confirm'">
          <v-btn variant="text" @click="step = 'params'">{{ t('price_lists.bulk_back') }}</v-btn>
          <v-btn color="primary" @click="run">{{ t('price_lists.bulk_apply') }}</v-btn>
        </template>
        <template v-else>
          <v-btn v-if="!running && batch" variant="text" color="error" @click="undo">
            {{ t('price_lists.bulk_undo') }}
          </v-btn>
          <v-btn color="primary" :disabled="running" @click="close(false)">{{ t('common.close') }}</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Modificación múltiple de listini en % (paridad listyupd_multi). Parámetros →
 * confirmación → ejecución por tandas con un mismo lote (batch), que permite
 * deshacer. Solo TMWE; el backend lo exige.
 */
import { ref, reactive, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import { listiniService, type BulkListinoResult, type BulkParams } from '../services/listini.service';

const props = defineProps<{ modelValue: boolean; listinoIds: number[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; done: [] }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const CHUNK = 20;
const OPS = ['FIX', 'PRC'];
const COLUMNS = [
  { key: 'fix', label: 'price_lists.fixed' },
  { key: 'min', label: 'price_lists.suppl_min' },
  { key: 'max', label: 'price_lists.suppl_max' },
  { key: 'akg', label: 'price_lists.per_kg' },
  { key: 'bnc', label: 'price_lists.suppl_per_collo' },
  { key: 'agg', label: 'price_lists.suppl_per_day' },
  { key: 'prc', label: 'price_lists.suppl_percent' },
];

const step = ref<'params' | 'confirm' | 'run'>('params');
const supplementTypes = ref<Array<{ id: number; nome: string }>>([]);
const running = ref(false);
const done = ref(0);
const batch = ref('');
const error = ref('');
const results = ref<BulkListinoResult[]>([]);

function emptyForm() {
  return {
    imp_zon: '',
    imp_bas: '',
    imp_min: '',
    opx_fix: 'ALL' as 'ALL' | 'NEW',
    oprz: {} as Record<string, 'FIX' | 'PRC' | null>,
    spp: Object.fromEntries(COLUMNS.map((c) => [c.key, {} as Record<number, string>])) as Record<string, Record<number, string>>,
  };
}
const form = reactive(emptyForm());

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    Object.assign(form, emptyForm());
    step.value = 'params';
    results.value = [];
    done.value = 0;
    batch.value = '';
    error.value = '';
    if (supplementTypes.value.length === 0) {
      try {
        // El legacy no muestra los suplementos 25 y 26 (solo sirven de nombre).
        supplementTypes.value = (await listiniService.supplementTypes()).filter((s) => s.id !== 25 && s.id !== 26);
      } catch {
        supplementTypes.value = [];
      }
    }
  },
);

const NUM = /^[0-9.-]{1,10}$/;

function params(): BulkParams {
  const p: BulkParams = { opx_fix: form.opx_fix };
  if (form.imp_zon) p.imp_zon = form.imp_zon;
  if (form.imp_bas) p.imp_bas = form.imp_bas;
  if (form.imp_min) p.imp_min = form.imp_min;
  const oprz: Record<string, 'FIX' | 'PRC'> = {};
  const spp: Record<string, Record<number, string>> = {};
  for (const c of COLUMNS) {
    const op = form.oprz[c.key];
    if (!op) continue;
    oprz[c.key] = op;
    for (const [sid, v] of Object.entries(form.spp[c.key])) {
      if (v) (spp[c.key] ??= {})[Number(sid)] = v;
    }
  }
  if (Object.keys(oprz).length) p.oprz = oprz;
  if (Object.keys(spp).length) p.spp = spp;
  return p;
}

const suppliesChanged = computed(() => Object.keys(params().spp ?? {}).length > 0);
const suppliesSummary = computed(() => {
  const spp = params().spp ?? {};
  const n = Object.values(spp).reduce((a, col) => a + Object.keys(col).length, 0);
  return t('price_lists.bulk_values_count', { n });
});

const canContinue = computed(() => {
  const p = params();
  const hasPct = Boolean(p.imp_zon || p.imp_bas || p.imp_min);
  const values = [p.imp_zon, p.imp_bas, p.imp_min, ...Object.values(p.spp ?? {}).flatMap((c) => Object.values(c))];
  return (hasPct || suppliesChanged.value) && values.every((v) => !v || NUM.test(v));
});

function resultLabel(r: BulkListinoResult): string {
  if (r.status !== 'ok') return t(`price_lists.bulk_status_${r.status}`);
  const bad = r.packs.filter((p) => p.status !== 'ok' && p.status !== 'already_applied');
  if (bad.length === 0) return t('price_lists.bulk_status_ok');
  return bad.map((p) => `#${p.pack_id}: ${p.status}`).join(' · ');
}

async function run(): Promise<void> {
  step.value = 'run';
  running.value = true;
  error.value = '';
  results.value = [];
  done.value = 0;
  try {
    batch.value = await listiniService.bulkNewBatch();
    const p = params();
    for (let i = 0; i < props.listinoIds.length; i += CHUNK) {
      const chunk = props.listinoIds.slice(i, i + CHUNK);
      const res = await listiniService.bulkApply(batch.value, chunk, p);
      results.value.push(...res);
      done.value += chunk.length;
    }
    toast.success(t('price_lists.bulk_done'));
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    running.value = false;
    emit('done');
  }
}

async function undo(): Promise<void> {
  const ok = await confirm.askDanger(t('price_lists.bulk_undo_confirm', { batch: batch.value }), t('price_lists.bulk_undo'));
  if (!ok) return;
  try {
    const r = await listiniService.bulkUndo(batch.value);
    toast.success(t('price_lists.bulk_undone', { n: r.packs, skipped: r.skipped }));
    emit('done');
    close(false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
}

function close(v: boolean): void {
  if (running.value) return;
  emit('update:modelValue', v);
}
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
.cm-summary {
  padding-left: 20px;
}
.cm-bulk-table :deep(th) {
  vertical-align: bottom;
}
</style>
