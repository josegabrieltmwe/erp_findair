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
      <v-col v-if="showPartnerFlag" cols="12" md="4">
        <v-checkbox
          v-model="form.erp_partner"
          true-value="S"
          false-value="N"
          :label="t('anagrafiche.admin_contact.erp_partner')"
          :hint="t('anagrafiche.admin_contact.erp_partner_hint')"
          persistent-hint
          density="compact"
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

    <!-- Alta de partner del sistema (solo TMWE): quién administrará la cuenta. La contraseña no se pide ni se
         muestra; el administrador recibe un enlace de acceso por correo. -->
    <section v-if="isPartnerCreate" class="cm-admin-contact mt-2" aria-labelledby="cm-admin-contact-title">
      <h3 id="cm-admin-contact-title" class="text-subtitle-1 mb-1">{{ t('anagrafiche.admin_contact.title') }}</h3>
      <p class="text-medium-emphasis text-body-2 mb-3">{{ t('anagrafiche.admin_contact.hint') }}</p>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="admin.nome"
            :label="t('anagrafiche.admin_contact.nome')"
            :rules="[ruleAdminNome]"
            :error-messages="serverError('admin_contact.nome')"
            density="compact"
            variant="outlined"
            autocomplete="off"
            @update:model-value="emit('clear-error', 'admin_contact.nome')"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="admin.mail"
            type="email"
            :label="t('anagrafiche.admin_contact.mail')"
            :rules="[ruleAdminMail]"
            :error-messages="serverError('admin_contact.mail')"
            density="compact"
            variant="outlined"
            autocomplete="off"
            @update:model-value="emit('clear-error', 'admin_contact.mail')"
          />
        </v-col>
      </v-row>
    </section>

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
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import { currenciesService } from '../services/currencies.service';
import { currencyToFlagEmoji } from '../utils/currencyCountry';
import { buildCreatePayload, isPartnerForm, validateAdminContact } from '../utils/accessLink';

const props = defineProps<{ saving?: boolean; fieldErrors?: Record<string, string> }>();
const emit = defineEmits<{
  create: [payload: Record<string, unknown>];
  cancel: [];
  'clear-error': [field: string];
}>();
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
  // Solo TMWE y solo con tipo P (ver watch más abajo); no se envía si no es partner.
  erp_partner: 'N',
});

// Administrador de la cuenta (solo alta de partner).
const admin = ref({ nome: '', mail: '' });

/** Alta de partner del sistema: TMWE + erp_partner S + tipo P. */
const isPartnerCreate = computed(() => isTmwe.value && isPartnerForm(form.value));
const showPartnerFlag = computed(() => isTmwe.value && form.value.tipo === 'P');

watch(
  () => form.value.tipo,
  (tipo) => {
    // Un partner del sistema es la opción normal al elegir tipo P; con otro tipo no hay partner.
    form.value.erp_partner = tipo === 'P' && isTmwe.value ? 'S' : 'N';
  },
);

function serverError(field: string): string[] {
  const m = props.fieldErrors?.[field];
  return m ? [m] : [];
}
function ruleAdminNome(v: unknown): true | string {
  const k = validateAdminContact({ nome: String(v ?? ''), mail: 'x@x.xx' })['admin_contact.nome'];
  return k ? (t(k) as string) : true;
}
function ruleAdminMail(v: unknown): true | string {
  const k = validateAdminContact({ nome: 'x', mail: String(v ?? '') })['admin_contact.mail'];
  return k ? (t(k) as string) : true;
}

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

// Solo TMWE da de alta partners: para el resto el tipo P no se ofrece.
const tipoItems = computed(() =>
  [
    { title: t('anagrafiche.type.CV'), value: 'CV' },
    { title: t('anagrafiche.type.C'), value: 'C' },
    { title: t('anagrafiche.type.P'), value: 'P' },
    { title: t('anagrafiche.type.F'), value: 'F' },
    { title: t('anagrafiche.type.T'), value: 'T' },
    { title: t('anagrafiche.type.I'), value: 'I' },
  ].filter((i) => i.value !== 'P' || isTmwe.value),
);

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
  // Enviar solo campos con valor; el backend rellena defaults de los ausentes. `admin_contact` solo si es partner.
  emit('create', buildCreatePayload(form.value, admin.value, isTmwe.value));
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
