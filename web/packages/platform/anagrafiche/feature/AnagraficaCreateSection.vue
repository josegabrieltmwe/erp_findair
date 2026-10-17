<template>
  <v-form ref="formRef" @submit.prevent="onSubmit">
    <p class="cm-create-hint text-medium-emphasis mb-4">
      {{ t('anagrafiche.create.hint') }}
    </p>

    <v-row dense>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.rag_soc"
          v-field-help="'rag_soc'"
          :label="t('anagrafiche.fields.rag_soc')"
          :rules="[ruleRequired]"
          density="compact"
          variant="outlined"
          autofocus
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="form.nome_breve"
          v-field-help="'nome_breve'"
          :label="t('anagrafiche.fields.nome_breve')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="form.tipo"
          v-field-help="'tipo'"
          :items="tipoItems"
          :label="t('anagrafiche.fields.tipo')"
          :disabled="!isTmwe"
          :hint="!isTmwe ? t('anagrafiche.fields.tipo_tmwe_only') : undefined"
          persistent-hint
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="form.pi_cf"
          v-field-help="'pi_cf'"
          :label="t('anagrafiche.fields.pi_cf')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="form.cf"
          v-field-help="'cf'"
          :label="t('anagrafiche.fields.cf')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="form.metric_imperial"
          v-field-help="'metric_imperial'"
          :items="metricItems"
          :label="t('anagrafiche.fields.metric_imperial')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-autocomplete
          v-model="form.valuta_sigla"
          v-field-help="'valuta_sigla'"
          :items="currencyItems"
          :loading="loadingCurrencies"
          :label="t('anagrafiche.fields.valuta_sigla')"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="form.legale"
          v-field-help="'legale'"
          :items="legaleItems"
          clearable
          :label="t('anagrafiche.fields.legale')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12">
        <v-textarea
          v-model="form.note"
          v-field-help="'note'"
          :label="t('anagrafiche.fields.note')"
          density="compact"
          variant="outlined"
          rows="2"
          auto-grow
        />
      </v-col>
    </v-row>

    <div class="cm-form-actions">
      <v-btn variant="text" :disabled="saving" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </v-btn>
      <v-btn color="primary" type="submit" :loading="saving">
        {{ t('anagrafiche.create.submit') }}
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import { currenciesService } from '../services/currencies.service';
import { currencyToFlagEmoji } from '../utils/currencyCountry';

defineProps<{ saving?: boolean }>();
const emit = defineEmits<{ create: [payload: Record<string, unknown>]; cancel: [] }>();
const { t } = useI18n();
const { isTmwe } = useAnagraficaContext();

// v-form ref para validar antes de emitir.
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null);

// Defaults de alta seguros. tipo='C' salvo que un operador TMWE lo cambie.
// El resto de defaults comerciales (id_agente, id_pagam_met/scad, diritto_fisso,
// suppl_carburante, tipo_pagamento, fattura, fatt_lingua) los aplica el backend
// en Anagrafica_Service::apply_commercial_defaults, así que NO los duplicamos aquí.
const form = ref<Record<string, unknown>>({
  rag_soc: '',
  nome_breve: '',
  tipo: 'C',
  pi_cf: '',
  cf: '',
  metric_imperial: 'M',
  valuta_sigla: '',
  legale: null,
  note: '',
});

// Divisas (valuta_sigla) desde el master global api_master_currencies.
// Mismo patrón que el form de edición (AnagraficaDatiBaseSection): autocomplete
// contra el catálogo `valute`, no input libre.
const currencyItems = ref<{ title: string; label: string; value: string }[]>([]);
const loadingCurrencies = ref(false);

// Etiqueta con bandera al inicio: "🇬🇧 GBP — UK Pounds".
function currencyLabel(sigla: string, nome?: string): string {
  const flag = currencyToFlagEmoji(sigla);
  const base = `${sigla} — ${nome ?? ''}`.trim();
  return flag ? `${flag} ${base}` : base;
}

onMounted(async () => {
  loadingCurrencies.value = true;
  try {
    const list = await currenciesService.list();
    currencyItems.value = list.map((c) => ({
      title: currencyLabel(c.sigla, c.nome),
      label: currencyLabel(c.sigla, c.nome),
      value: c.sigla,
    }));
  } catch {
    // Silencioso: si el master falla, el autocomplete queda vacío pero el form
    // sigue operativo (valuta_sigla es opcional al crear).
  } finally {
    loadingCurrencies.value = false;
  }
});

function ruleRequired(v: unknown): true | string {
  if (typeof v === 'string' && v.trim().length > 0) return true;
  return t('selectors.required') as string;
}

const tipoItems = [
  { title: t('anagrafiche.type.CV'), value: 'CV' },
  { title: t('anagrafiche.type.C'), value: 'C' },
  { title: t('anagrafiche.type.P'), value: 'P' },
  { title: t('anagrafiche.type.F'), value: 'F' },
  { title: t('anagrafiche.type.T'), value: 'T' },
  { title: t('anagrafiche.type.I'), value: 'I' },
];

const metricItems = [
  { title: t('anagrafiche.metric.metric_kg'), value: 'M' },
  { title: t('anagrafiche.metric.imperial_lb'), value: 'I' },
];

const legaleItems = [
  { title: t('common.no'), value: 'N' },
  { title: t('common.yes'), value: 'S' },
  { title: t('anagrafiche.fields.legale_pending'), value: 'P' },
];

async function onSubmit(): Promise<void> {
  const result = await formRef.value?.validate();
  if (result && !result.valid) return;
  // Enviar solo campos con valor; el backend rellena defaults de los ausentes.
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form.value)) {
    if (v !== null && v !== '') payload[k] = v;
  }
  emit('create', payload);
}
</script>

<style scoped>
.cm-create-hint {
  max-width: 640px;
}
.cm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--cm-space-sm, 8px);
  margin-top: var(--cm-space-md, 16px);
}
</style>
