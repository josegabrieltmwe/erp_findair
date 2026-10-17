<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <v-card v-if="row">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiTuneVariant" class="mr-2" />
        {{ t('anagrafiche.listini.edit_title') }}
      </v-card-title>

      <!-- Cabecera de solo lectura: qué servicio se está editando -->
      <v-card-subtitle class="pb-0">
        <template v-if="isHouseFee">{{ row.servizio_nome }}</template>
        <span v-else class="font-weight-medium">
          {{ row.servizio_paese }}-{{ row.servizio_tipo }}
        </span>
        <template v-if="!isHouseFee">· {{ stripTags(row.servizio_nome || row.servizio_descr || '') }}</template>
        <v-chip v-if="!isHouseFee && row.servizio_import === 'S'" size="x-small" color="amber-darken-2" variant="tonal" class="ml-1">IMP</v-chip>
      </v-card-subtitle>

      <v-card-text v-if="isHouseFee">
        <v-text-field
          v-model="houseFeeInput"
          type="number" step="0.01" min="0" clearable
          :label="t('anagrafiche.listini.house_fee_amount')"
          :hint="t('anagrafiche.listini.house_fee_hint')"
          :placeholder="row.owner_prf_fix != null ? String(row.owner_prf_fix) : ''"
          persistent-hint prefix="€"
          density="comfortable" variant="outlined"
        />
      </v-card-text>
      <v-card-text v-else>
        <!-- Tipo L/P -->
        <v-btn-toggle
          v-model="form.tipo"
          density="comfortable"
          variant="outlined"
          divided
          mandatory
          class="mb-4"
        >
          <v-btn value="L">{{ t('anagrafiche.listini.lst') }}</v-btn>
          <v-btn value="P">{{ t('anagrafiche.listini.profit') }}</v-btn>
        </v-btn-toggle>

        <!-- Rama LISTINO -->
        <template v-if="form.tipo === 'L'">
          <div class="d-flex align-center" style="gap: 8px;">
            <v-select
              v-model="form.id_listino_nome"
              :items="listinoOptions"
              item-title="nome"
              item-value="id"
              :label="t('anagrafiche.listini.listino')"
              density="comfortable"
              variant="outlined"
              hide-details
              class="flex-grow-1"
            />
            <v-tooltip :text="t('anagrafiche.listini.show_price_list')" location="top">
              <template #activator="{ props: tp }">
                <v-btn
                  v-bind="tp"
                  :icon="mdiEyeOutline"
                  variant="text"
                  :disabled="!form.id_listino_nome"
                  @click="emit('show-prices', row)"
                />
              </template>
            </v-tooltip>
          </div>
          <div class="d-flex mt-4" style="gap: 12px;">
            <v-text-field
              v-model.number="form.coefficiente"
              type="number" step="0.01"
              :label="t('anagrafiche.listini.coef')"
              density="comfortable" variant="outlined" hide-details
            />
            <v-text-field
              v-model.number="form.fuel_surc"
              type="number" step="0.01"
              :label="t('anagrafiche.listini.fuel_pct')"
              suffix="%"
              density="comfortable" variant="outlined" hide-details
            />
          </div>
        </template>

        <!-- Rama PROFIT -->
        <template v-else>
          <div class="d-flex" style="gap: 12px;">
            <v-text-field
              v-model.number="form.prf_mod"
              type="number" step="0.01"
              :label="t('anagrafiche.listini.prf_mod')"
              suffix="%"
              density="comfortable" variant="outlined" hide-details
            />
            <v-text-field
              v-model.number="form.prf_fix"
              type="number" step="0.01"
              :label="t('anagrafiche.listini.prf_fix')"
              prefix="€"
              density="comfortable" variant="outlined" hide-details
            />
          </div>
          <v-switch
            v-model="form.forza_API"
            color="warning"
            :label="t('anagrafiche.listini.forza_api')"
            hide-details
            class="mt-2"
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="submit">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiEyeOutline, mdiTuneVariant } from '@mdi/js';
import { serviceConfigService, type ServiceConfigRow } from '../services/serviceConfig.service';
import { useToast } from '../composables/useToast';
import { stripTags } from '../../utils/text';

const props = defineProps<{
  modelValue: boolean;
  idAnagrafica: number;
  row: ServiceConfigRow | null;
  /** Catálogo de listini disponibles para este servizio (id+nome). */
  listini: { id: number; nome: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
  'show-prices': [row: ServiceConfigRow];
}>();

const { t } = useI18n();
const toast = useToast();
const saving = ref(false);

interface FormShape {
  tipo: 'L' | 'P';
  id_listino_nome: number;
  coefficiente: number;
  fuel_surc: number;
  prf_mod: number;
  prf_fix: number;
  forza_API: boolean;
}

const form = ref<FormShape>({
  tipo: 'L', id_listino_nome: 0, coefficiente: 0, fuel_surc: 0, prf_mod: 0, prf_fix: 0, forza_API: false,
});

const isHouseFee = computed(() => props.row?.special === 'house_fee');
// '' = sin valor propio (se aplica el del titular)
const houseFeeInput = ref<string | number | null>('');

const BASE_OPT = computed(() => ({ id: 0, nome: t('anagrafiche.listini.base_price') as string }));
const listinoOptions = computed(() => [BASE_OPT.value, ...props.listini]);

// Al abrir, copiar la fila al form (snapshot editable).
watch(
  () => [props.modelValue, props.row] as const,
  ([open, row]) => {
    if (open && row) {
      houseFeeInput.value = row.prf_fix ?? '';
      form.value = {
        tipo: (row.tipo === 'P' ? 'P' : 'L'),
        id_listino_nome: Number(row.id_listino_nome) || 0,
        coefficiente: Number(row.coefficiente) || 0,
        fuel_surc: Number(row.fuel_surc) || 0,
        prf_mod: Number(row.prf_mod) || 0,
        prf_fix: Number(row.prf_fix) || 0,
        forza_API: row.forza_API === 'S',
      };
    }
  },
  { immediate: true },
);

/**
 * Guarda solo los campos que cambiaron respecto a la fila original (paridad
 * legacy: cada campo es un UPDATE independiente vía updateField). Esto evita
 * tocar columnas no editadas y mantiene el log de cambios fiel.
 */
async function submit(): Promise<void> {
  const row = props.row;
  if (!row) return;
  saving.value = true;
  try {
    const changes: Array<[string, unknown]> = [];
    const f = form.value;

    if (isHouseFee.value) {
      const raw = houseFeeInput.value;
      const next = raw === null || raw === '' ? '' : Number(raw);
      if (next !== '' && (!Number.isFinite(next) || next < 0)) throw new Error(t('common.error') as string);
      if (next !== (row.prf_fix ?? '')) await serviceConfigService.updateField(props.idAnagrafica, row.id_servizio, 'prf_fix', next);
      toast.success(t('anagrafiche.updated'));
      emit('saved');
      emit('update:modelValue', false);
      return;
    }

    if (f.tipo !== (row.tipo === 'P' ? 'P' : 'L')) changes.push(['tipo', f.tipo]);

    if (f.tipo === 'L') {
      if (f.id_listino_nome !== (Number(row.id_listino_nome) || 0)) changes.push(['id_listino_nome', f.id_listino_nome]);
      if (f.coefficiente !== (Number(row.coefficiente) || 0)) changes.push(['coefficiente', f.coefficiente]);
      if (f.fuel_surc !== (Number(row.fuel_surc) || 0)) changes.push(['fuel_surc', f.fuel_surc]);
    } else {
      if (f.prf_mod !== (Number(row.prf_mod) || 0)) changes.push(['prf_mod', f.prf_mod]);
      if (f.prf_fix !== (Number(row.prf_fix) || 0)) changes.push(['prf_fix', f.prf_fix]);
      const forza = f.forza_API ? 'S' : 'N';
      if (forza !== (row.forza_API ?? 'N')) changes.push(['forza_API', forza]);
    }

    if (!changes.length) {
      emit('update:modelValue', false);
      return;
    }

    for (const [field, value] of changes) {
      await serviceConfigService.updateField(props.idAnagrafica, row.id_servizio, field, value);
    }
    toast.success(t('anagrafiche.updated'));
    emit('saved');
    emit('update:modelValue', false);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    saving.value = false;
  }
}
</script>
