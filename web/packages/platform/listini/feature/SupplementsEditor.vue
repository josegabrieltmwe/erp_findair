<template>
  <CmAsyncSection :loading="loading" :error="error" :empty="false" :data="rows" @clear-error="error = null">
    <template #default>
      <div v-if="data && !data.version" class="cm-detail-hint">{{ t('price_lists.suppl_no_version') }}</div>
      <template v-else>
        <div class="d-flex align-center flex-wrap ga-3 mb-3">
          <v-switch
            v-model="onlyWithCost"
            :label="t('price_lists.suppl_only_with_cost')"
            density="compact"
            hide-details
            color="primary"
          />
          <v-autocomplete
            v-model="addId"
            :items="addableTypes"
            item-title="nome"
            item-value="id"
            :label="t('price_lists.suppl_add')"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="cm-suppl-add"
            @update:model-value="onAdd"
          />
          <v-spacer />
          <v-btn-toggle v-model="mode" mandatory density="compact" variant="outlined" color="primary">
            <v-btn value="ACT" size="small">{{ t('price_lists.suppl_mode_act') }}</v-btn>
            <v-btn value="NEW" size="small">{{ t('price_lists.suppl_mode_new') }}</v-btn>
          </v-btn-toggle>
          <v-btn color="primary" size="small" :loading="saving" :disabled="!dirty" @click="save">
            {{ t('price_lists.suppl_save') }}
          </v-btn>
        </div>
        <div class="cm-cell-hint mb-2">
          {{ mode === 'ACT' ? t('price_lists.suppl_hint_act') : t('price_lists.suppl_hint_new') }}
          <span v-if="data?.future"> {{ t('price_lists.suppl_future_note', { start: data.future.data_start.slice(0, 10) }) }}</span>
        </div>

        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t('price_lists.supplement') }}</th>
              <th v-for="c in COLUMNS" :key="c.key" class="text-right">{{ t(c.label) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in visibleRows" :key="r.id">
              <td class="font-weight-medium">{{ r.nome }}</td>
              <td v-for="c in COLUMNS" :key="c.key" style="min-width: 90px">
                <v-text-field
                  v-model.number="draft[r.id][c.key]"
                  type="number"
                  min="0"
                  step="any"
                  density="compact"
                  variant="underlined"
                  hide-details
                  @update:model-value="dirty = true"
                />
              </td>
            </tr>
            <tr v-if="visibleRows.length === 0">
              <td :colspan="COLUMNS.length + 1" class="text-center cm-cell-hint">{{ t('price_lists.empty_supplements') }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </template>
  </CmAsyncSection>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CmAsyncSection from '@shared/anagrafiche/components/CmAsyncSection.vue';
import { useToastStore } from '@shared/anagrafiche/stores/toast.store';
import { useConfirm } from '@shared/anagrafiche/composables/useConfirm';
import {
  listiniService,
  type SupplementColumn,
  type SupplementEditorData,
} from '../services/listini.service';

const props = defineProps<{ packId: number }>();
const emit = defineEmits<{ (e: 'saved'): void }>();

const { t } = useI18n();
const toast = useToastStore();
const confirm = useConfirm();

const COLUMNS: Array<{ key: SupplementColumn; label: string }> = [
  { key: 'costo_fisso', label: 'price_lists.fixed' },
  { key: 'costo_min', label: 'price_lists.suppl_min' },
  { key: 'costo_max', label: 'price_lists.suppl_max' },
  { key: 'costo_kg', label: 'price_lists.per_kg' },
  { key: 'costo_collo', label: 'price_lists.suppl_per_collo' },
  { key: 'costo_gg', label: 'price_lists.suppl_per_day' },
  { key: 'costo_perc', label: 'price_lists.suppl_percent' },
];

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const data = ref<SupplementEditorData | null>(null);
const draft = ref<Record<number, Partial<Record<SupplementColumn, number>>>>({});
const added = ref<Set<number>>(new Set());
const onlyWithCost = ref(true);
const mode = ref<'ACT' | 'NEW'>('ACT');
const dirty = ref(false);
const addId = ref<number | string | null>(null);

const rows = computed(() => (data.value?.types ?? []).map((x) => ({ id: Number(x.id), nome: x.nome })));

function hasCost(id: number): boolean {
  const d = draft.value[id];
  return !!d && COLUMNS.some((c) => Number(d[c.key] ?? 0) !== 0);
}

const visibleRows = computed(() =>
  rows.value.filter((r) => !onlyWithCost.value || hasCost(r.id) || added.value.has(r.id)),
);
const addableTypes = computed(() => rows.value.filter((r) => !visibleRows.value.some((v) => v.id === r.id)));

function onAdd(id: number | string | null): void {
  if (id == null) return;
  added.value.add(Number(id));
  added.value = new Set(added.value);
  addId.value = null;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const d = await listiniService.getSupplementEditor(props.packId);
    data.value = d;
    const next: Record<number, Partial<Record<SupplementColumn, number>>> = {};
    for (const ty of d.types) {
      const id = Number(ty.id);
      const cur = d.values[String(id)] ?? {};
      next[id] = {};
      for (const c of COLUMNS) next[id][c.key] = Number(cur[c.key] ?? 0);
    }
    draft.value = next;
    added.value = new Set();
    dirty.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  const ok = await confirm.askDanger(
    t(mode.value === 'ACT' ? 'price_lists.suppl_confirm_act' : 'price_lists.suppl_confirm_new'),
    t('price_lists.suppl_confirm_title'),
  );
  if (!ok) return;
  saving.value = true;
  try {
    // El conjunto completo: lo que no se envía de un suplemento existente queda a 0.
    const values: Record<number, Partial<Record<SupplementColumn, number>>> = {};
    for (const r of rows.value) values[r.id] = { ...draft.value[r.id] };
    const res = await listiniService.saveSupplements(
      props.packId,
      mode.value,
      rows.value.map((r) => r.id),
      values,
    );
    toast.success(t(res.changed ? 'price_lists.suppl_saved' : 'price_lists.suppl_no_changes'));
    await load();
    emit('saved');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

watch(() => props.packId, load, { immediate: true });
</script>

<style scoped>
.cm-suppl-add {
  max-width: 280px;
}
.cm-detail-hint {
  text-align: center;
  padding: 40px;
}
</style>
