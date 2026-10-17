<template>
  <v-form class="cm-form" @submit.prevent="onSave">
    <!-- ── Sección 1: Datos de facturación ── -->
    <section class="cm-form-section">
      <div class="cm-form-subheading">{{ t('anagrafiche.fatturazione.section_dati') }}</div>
      <div class="cm-form-section__body">
        <v-row dense>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.tipo_pagamento"
          v-field-help="'tipo_pagamento'"
              :items="pagItems"
              :label="t('anagrafiche.fields.tipo_pagamento')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.fattura"
          v-field-help="'fattura'"
              :items="boolItems"
              :label="t('anagrafiche.fields.fattura')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.esente_IVA"
              :items="exemptItems"
              :label="t('anagrafiche.fields.esente_IVA')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="form.diritto_fisso"
          v-field-help="'diritto_fisso'"
              :label="t('anagrafiche.fields.diritto_fisso')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="form.scelta_corr_perc"
          v-field-help="'scelta_corr_perc'"
              :label="t('anagrafiche.fields.scelta_corr_perc')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="form.ass_minimo"
          v-field-help="'ass_minimo'"
              :label="t('anagrafiche.fields.ass_minimo')"
              type="number"
              step="0.01"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.fatt_lingua"
          v-field-help="'fatt_lingua'"
              :items="langItems"
              :label="t('anagrafiche.fields.fatt_lingua')"
              density="compact"
              variant="outlined"
            />
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- ── Sección 2: Condiciones comerciales (paridad legacy anagr_form.php TAB 1) ── -->
    <section class="cm-form-section">
      <div class="cm-form-subheading">{{ t('anagrafiche.commerciale.title') }}</div>
      <div class="cm-form-section__body">
        <v-row dense>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_pagam_met"
              :items="payMethodItems"
              :loading="commLoading"
              item-title="title"
              item-value="value"
              clearable
              :label="t('anagrafiche.fields.id_pagam_met')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_pagam_scad"
              :items="payScheduleItems"
              :loading="commLoading"
              item-title="title"
              item-value="value"
              clearable
              :label="t('anagrafiche.fields.id_pagam_scad')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_agente"
              :items="agentItems"
              :loading="commLoading"
              item-title="title"
              item-value="value"
              clearable
              :label="t('anagrafiche.fields.id_agente')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.scelta_forn"
          v-field-help="'scelta_forn'"
              :items="sceltaFornItems"
              clearable
              :label="t('anagrafiche.fields.scelta_forn')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_settore_cliente"
          v-field-help="'id_settore_cliente'"
              :items="sectorItems"
              :loading="commLoading"
              item-title="title"
              item-value="value"
              clearable
              :label="t('anagrafiche.fields.id_settore_cliente')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="form.descriz_settore"
          v-field-help="'descriz_settore'"
              :label="t('anagrafiche.fields.descriz_settore')"
              density="compact"
              variant="outlined"
            />
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- ── Sección 3: Flags de fatturazione / operativos ── -->
    <section class="cm-form-section">
      <div class="cm-form-subheading">{{ t('anagrafiche.flags.title') }}</div>
      <div class="cm-form-section__body">
        <v-row dense>
          <v-col v-for="f in billingFlags" :key="f" cols="12" sm="6" md="4">
            <v-switch
              v-model="form[f]"
              v-field-help="f"
              :label="t('anagrafiche.flags.' + f)"
              true-value="S"
              false-value="N"
              density="compact"
              hide-details
              inset
              color="primary"
            />
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- ── Sección 4: B2B + tipo record ── -->
    <section class="cm-form-section">
      <div class="cm-form-subheading">{{ t('anagrafiche.b2b.title') }}</div>
      <div class="cm-form-section__body">
        <v-row dense align="center">
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.tipo_record"
          v-field-help="'tipo_record'"
              :items="tipoRecordItems"
              :label="t('anagrafiche.fields.tipo_record')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="form.b2b_codcli_reg"
          v-field-help="'b2b_codcli_reg'"
              :label="t('anagrafiche.b2b.codcli_reg')"
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4" class="d-flex align-center">
            <v-switch
              v-model="form.b2b_codcli_obbl"
          v-field-help="'b2b_codcli_obbl'"
              :label="t('anagrafiche.b2b.codcli_obbl')"
              true-value="S"
              false-value="N"
              density="compact"
              hide-details
              inset
              color="primary"
            />
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- ── Sección 5: Bloqueos por carrier (candado + switch) ── -->
    <section class="cm-form-section">
      <div class="cm-form-subheading">{{ t('anagrafiche.blocchi.title') }}</div>
      <div class="cm-form-section__body">
        <v-row dense>
          <v-col cols="12" sm="6" md="4">
            <CmLockSwitch
              v-model="form.blocca_corriere"
          v-field-help="'blocca_corriere'"
              :label="t('anagrafiche.blocchi.blocca_corriere')"
            />
          </v-col>
          <v-col v-for="c in carrierBlocks" :key="c.field" cols="12" sm="6" md="4">
            <CmLockSwitch v-model="form[c.field]" v-field-help="c.field" :label="c.label" />
          </v-col>
        </v-row>
      </div>
    </section>

    <div class="cm-form-actions">
      <v-btn variant="text" @click="reset">{{ t('common.reset') }}</v-btn>
      <v-btn color="primary" type="submit" :loading="saving" :disabled="!dirty">
        {{ t('common.save') }}
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnagraficaDetail } from '../services/anagrafica.service';
import { paymentsService, sectorsService } from '../services/payments.service';
import { clientCausalsService } from '../services/clientCausals.service';
import { contattiService } from '../services/contatti.service';
import { useAnagraficaContext } from '../composables/useAnagraficaContext';
import CmLockSwitch from '../components/CmLockSwitch.vue';

const props = defineProps<{ modelValue: AnagraficaDetail }>();
const emit = defineEmits<{ save: [payload: Record<string, unknown>] }>();
const { t, locale: i18nLocale } = useI18n();
const { scopeTitolare } = useAnagraficaContext();

const saving = ref(false);
const form = ref<Record<string, unknown>>({});
const original = ref<Record<string, unknown>>({});

// Fase B: flags de fatturazione/operativos (columnas enum('S','N') de anagrafiche).
const billingFlags = [
  'fatt_sped_posta', 'fatt_sped_fax', 'solleciti_invia',
  'pec_fatture', 'pec_solleciti', 'alert_mail', 'alert_fax',
  'delivered_mail', 'autoblocco14gg', 'fastlink', 'upsfull',
  // Fase 3: paridad anagr_form.php sección C (nivel anagrafiche). Solo S/N.
  'ldv_corriere_sepresa',
] as const;

// Fase C: bloqueos por carrier (paridad legacy anagr_form.php:332-337).
// ids fijos: 2=DHL, 3=UPS, 5=BRT, 7=FedEx, 8=TNT, 3338=Palletways.
const carrierBlocks: { field: string; label: string }[] = [
  { field: 'blocca_CORR_2', label: 'DHL' },
  { field: 'blocca_CORR_3', label: 'UPS' },
  { field: 'blocca_CORR_7', label: 'FedEx' },
  { field: 'blocca_CORR_8', label: 'TNT' },
  { field: 'blocca_CORR_5', label: 'BRT' },
  { field: 'blocca_CORR_3338', label: 'Palletways' },
];

const COMMERCIAL_KEYS = [
  'tipo_pagamento', 'fattura', 'diritto_fisso', 'fatt_lingua', 'esente_IVA',
  'scelta_corr_perc', 'ass_minimo',
  // paridad legacy TAB 1
  'id_pagam_met', 'id_pagam_scad', 'id_agente', 'scelta_forn',
  'id_settore_cliente', 'descriz_settore',
  // Fase B (flags) + Fase C (bloqueos carrier)
  ...billingFlags,
  'blocca_corriere', ...carrierBlocks.map((c) => c.field),
  // Fase 3: B2B + tipo record
  'tipo_record', 'b2b_codcli_obbl', 'b2b_codcli_reg',
];

// tipo_record = enum('R','C') — NO es S/N; se edita con select propio.
const tipoRecordItems = [
  { title: t('anagrafiche.tipo_record.C'), value: 'C' },
  { title: t('anagrafiche.tipo_record.R'), value: 'R' },
];

function snapshot(rec: AnagraficaDetail): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const r = rec as Record<string, unknown>;
  for (const k of COMMERCIAL_KEYS) {
    // los flags S/N nunca deben quedar null (v-switch necesita 'S'|'N')
    if ((billingFlags as readonly string[]).includes(k)
        || k === 'blocca_corriere'
        || k === 'b2b_codcli_obbl'
        || k.startsWith('blocca_CORR_')) {
      out[k] = r[k] === 'S' ? 'S' : 'N';
    } else if (k === 'tipo_record') {
      // enum('R','C'); default 'R' cuando viene vacío (no S/N).
      out[k] = r[k] === 'C' ? 'C' : 'R';
    } else {
      out[k] = r[k] ?? null;
    }
  }
  return out;
}

// --- Opciones de los selects comerciales (pobladas por el titolare del cliente) ---
type Opt = { title: string; value: number | string };
const payMethodItems = ref<Opt[]>([]);
const payScheduleItems = ref<Opt[]>([]);
const agentItems = ref<Opt[]>([]);
const sectorItems = ref<Opt[]>([]);
const commLoading = ref(false);

const sceltaFornItems = computed<Opt[]>(() => [
  { title: t('anagrafiche.commerciale.scelta_forn_bsi'), value: 'BSI' },
  { title: t('anagrafiche.commerciale.scelta_forn_esi'), value: 'ESI' },
  { title: t('anagrafiche.commerciale.scelta_forn_bes'), value: 'BES' },
]);

/**
 * El titolare cuya config comercial debe poblar los selects. Para un partner
 * es undefined (el backend usa la sesión); para TMWE es el id_anagr_titolare
 * del cliente que se edita.
 */
const titolareId = computed(() =>
  scopeTitolare((props.modelValue as Record<string, unknown>)?.id_anagr_titolare as number | undefined),
);

async function loadCommercialOptions(): Promise<void> {
  commLoading.value = true;
  try {
    const tid = titolareId.value;
    const [methods, schedules, sectors] = await Promise.all([
      paymentsService.paymentMethods(undefined, tid).catch(() => []),
      paymentsService.paymentSchedules(tid).catch(() => []),
      sectorsService.list().catch(() => []),
    ]);
    payMethodItems.value = methods.map((m) => ({ title: m.descr ?? `#${m.id}`, value: m.id }));
    payScheduleItems.value = schedules.map((s) => ({ title: s.label ?? s.descr ?? `#${s.id}`, value: s.id }));
    sectorItems.value = sectors.map((s) => ({ title: s.descr ?? `#${s.id}`, value: s.id }));

    // Agentes = contatti tipo agente del titolare. Sin titolare (partner) el
    // backend de contatti exige id_anagrafica → usar el propio del cliente.
    const agentAnag = tid ?? ((props.modelValue as Record<string, unknown>)?.id_anagr_titolare as number | undefined);
    if (agentAnag && agentAnag > 0) {
      const contacts = await contattiService.listByPartner(agentAnag).catch(() => []);
      agentItems.value = contacts.map((c) => ({
        title: c.nome ?? `#${c.id}`,
        value: c.id as number,
      }));
    } else {
      agentItems.value = [];
    }
  } finally {
    commLoading.value = false;
  }
}

// esente_IVA NO es un boolean S/N: es el tipo de régimen IVA del cliente.
// Paridad legacy anagr_array.php:127 — dropdown DINÁMICO poblado con los `tipo`
// de fatture_causali_clienti que hacen match con fatture_causali_new.tipo_cli_base
// (21=IVA ordinaria, S=lett. intenti, S1=ExtraUE art.7, S2=UE art.9, SN=ambasciate).
// Antes estaba hardcoded a N/S/S2 con etiquetas erróneas → 21 (mayoría) y S1/SN no
// se podían seleccionar y se corrompían al editar. Se carga del endpoint que ya
// sirve el catálogo (Client_Causals_Controller); el locale elige descr/descrEN.
const EXEMPT_TIPI = ['21', 'S1', 'S2', 'S', 'SN'];
const exemptItems = ref<Opt[]>([]);

async function loadExemptOptions(): Promise<void> {
  try {
    const catalog = await clientCausalsService.list(0).catch(() => []);
    const isEN = (i18nLocale.value || '').toLowerCase().startsWith('en');
    const opts = catalog
      .filter((c) => c.tipo != null && EXEMPT_TIPI.includes(String(c.tipo)))
      .map((c) => ({
        title: (isEN ? c.descrEN : c.descr) || c.descr || String(c.tipo),
        value: String(c.tipo),
      }));
    exemptItems.value = opts.length ? opts : EXEMPT_TIPI.map((v) => ({ title: v, value: v }));
  } catch {
    exemptItems.value = EXEMPT_TIPI.map((v) => ({ title: v, value: v }));
  }
}

watch(() => props.modelValue, (rec) => {
  form.value = snapshot(rec);
  original.value = JSON.parse(JSON.stringify(form.value));
  void loadCommercialOptions();
  void loadExemptOptions();
}, { immediate: true });

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(original.value));

const pagItems = [
  { title: t('anagrafiche.fatturazione.anticipato'), value: 'A' },
  { title: t('anagrafiche.fatturazione.riba_bonifico'), value: 'R' },
  { title: t('anagrafiche.fatturazione.saldo_fattura'), value: 'S' },
];
const boolItems = [
  { title: t('common.yes'), value: 'S' },
  { title: t('common.no'), value: 'N' },
];
const langItems = [
  { title: 'IT', value: 'IT' },
  { title: 'EN', value: 'EN' },
];
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
</script>

<style scoped>
.cm-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
