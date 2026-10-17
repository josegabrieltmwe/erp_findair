<template>
  <v-form class="cm-form" @submit.prevent="onSave">
    <v-row dense>
      <v-col cols="12" sm="6" md="6">
        <v-text-field
          v-model="form.rag_soc"
          v-field-help="'rag_soc'"
          :label="t('anagrafiche.fields.rag_soc')"
          :rules="[ruleRequired]"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" sm="6" md="6">
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
          :append-inner-icon="mdiCheckDecagram"
          @click:append-inner="onCheckVies"
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
      <v-col cols="12" sm="6" md="4" class="d-flex align-center">
        <CmLockSwitch
          v-model="form.bloccato"
          v-field-help="'bloccato'"
          :label="t('anagrafiche.fields.bloccato')"
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
      <v-col cols="12" md="4">
        <v-text-field
          v-model="form.scad_listino"
          v-field-help="'scad_listino'"
          type="date"
          :label="t('anagrafiche.fields.scad_listino')"
          density="compact"
          variant="outlined"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="form.url_real"
          v-field-help="'url_real'"
          :label="t('anagrafiche.fields.url_real')"
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
          rows="3"
          auto-grow
        />
      </v-col>
    </v-row>

    <div class="cm-form-actions">
      <v-btn variant="text" @click="reset">{{ t('common.reset') }}</v-btn>
      <v-btn color="primary" type="submit" :loading="saving" :disabled="!dirty">
        {{ t('common.save') }}
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheckDecagram } from '@mdi/js';
import type { AnagraficaDetail } from '../services/anagrafica.service';
import { viesService } from '../services/vies.service';
import { currenciesService } from '../services/currencies.service';
import { currencyToFlagEmoji } from '../utils/currencyCountry';
import { useToast } from '../composables/useToast';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import CmLockSwitch from '../components/CmLockSwitch.vue';

const props = defineProps<{ modelValue: AnagraficaDetail }>();
const emit = defineEmits<{ save: [payload: Record<string, unknown>] }>();
const { t } = useI18n();
const toast = useToast();
const { isTmwe } = useAnagraficaContext();

const form = ref<Record<string, unknown>>({});
const saving = ref(false);
const original = ref<Record<string, unknown>>({});

function snapshotFields(rec: AnagraficaDetail): Record<string, unknown> {
  const keys = ['rag_soc', 'nome_breve', 'tipo', 'pi_cf', 'cf', 'metric_imperial', 'valuta_sigla', 'bloccato', 'note',
    // Fase D: campos sueltos TAB 1
    'legale', 'scad_listino', 'url_real'];
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = (rec as Record<string, unknown>)[k] ?? null;
  return out;
}

watch(() => props.modelValue, (rec) => {
  form.value = snapshotFields(rec);
  original.value = JSON.parse(JSON.stringify(form.value));
}, { immediate: true });

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value));

function ruleRequired(v: unknown): true | string {
  if (typeof v === 'string' && v.trim().length > 0) return true;
  return t('selectors.required') as string;
}

// anagrafiche.tipo = enum('CV','C','P','F','T','TP','I','A'). El backend no
// valida enum (Anagrafica_Crud_Controller), pero la columna DB sí los admite.
const tipoItems = [
  { title: t('anagrafiche.type.CV'), value: 'CV' },
  { title: t('anagrafiche.type.C'), value: 'C' },
  { title: t('anagrafiche.type.P'), value: 'P' },
  { title: t('anagrafiche.type.F'), value: 'F' },
  { title: t('anagrafiche.type.T'), value: 'T' },
  { title: t('anagrafiche.type.TP'), value: 'TP' },
  { title: t('anagrafiche.type.I'), value: 'I' },
  { title: t('anagrafiche.type.A'), value: 'A' },
];

const metricItems = [
  { title: t('anagrafiche.metric.metric_kg'), value: 'M' },
  { title: t('anagrafiche.metric.imperial_lb'), value: 'I' },
];

// Fase D: legale = enum('N','S','P') en anagrafiche.
const legaleItems = [
  { title: t('common.no'), value: 'N' },
  { title: t('common.yes'), value: 'S' },
  { title: t('anagrafiche.fields.legale_pending'), value: 'P' },
];

// Divisas (valuta_sigla) desde el master global api_master_currencies.
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
    // Preserva el valor actual aunque no esté en el master (evita que el
    // autocomplete lo borre visualmente al no encontrar coincidencia).
    const cur = form.value.valuta_sigla as string | undefined;
    if (cur && !currencyItems.value.some((i) => i.value === cur)) {
      currencyItems.value.unshift({ title: currencyLabel(cur), label: currencyLabel(cur), value: cur });
    }
  } catch {
    // Silencioso: si el master falla, el usuario aún ve el valor persistido.
  } finally {
    loadingCurrencies.value = false;
  }
});

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    emit('save', { ...form.value });
    original.value = JSON.parse(JSON.stringify(form.value));
  } finally {
    saving.value = false;
  }
}

function reset(): void {
  form.value = JSON.parse(JSON.stringify(original.value));
}

async function onCheckVies(): Promise<void> {
  try {
    const r = await viesService.check({ id_anagrafica: props.modelValue.id });
    if (r.valid) {
      toast.success(`${t('anagrafiche.vies.ok')}: ${r.name ?? ''}`);
    } else {
      toast.warning(t('anagrafiche.vies.ko'));
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  }
}
</script>

<style scoped>
.cm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--cm-space-sm, 8px);
  margin-top: var(--cm-space-md, 16px);
}
</style>
