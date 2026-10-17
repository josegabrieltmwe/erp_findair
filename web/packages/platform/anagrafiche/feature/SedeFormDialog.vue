<template>
  <v-dialog :model-value="modelValue" max-width="720" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title>{{ isEdit ? t('common.edit') : t('common.add') }} — {{ t('anagrafiche.tabs.sedi') }}</v-card-title>
      <v-card-text class="cm-sede-body">
        <!-- ═══ Datos de la sede ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiOfficeBuildingMarkerOutline" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_dati') }}
          </div>
          <v-row dense>
            <v-col cols="12" md="8">
              <v-text-field
                v-model="form.label"
                v-field-help="'label'"
                :label="t('anagrafiche.fields.rag_soc')"
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <CmCountrySelect v-model="form.id_paese_iso" :label="t('anagrafiche.col_paese')" />
            </v-col>
          </v-row>
        </div>

        <!-- ═══ Dirección ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiMapMarkerOutline" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_indirizzo') }}
          </div>
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="form.indirizzo"
                :label="t('common.address')"
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="3">
              <CmCapField
                v-model="form.cap"
                :country="form.id_paese_iso"
                :geo="geo"
                :label="t('anagrafiche.fields.cap')"
                @resolved="onCapResolved"
              />
            </v-col>
            <v-col cols="12" md="6">
              <CmCittaField
                v-model="form.citta"
                :suggestions="geo.citySuggestions.value"
                :label="t('anagrafiche.col_citta')"
              />
            </v-col>
            <v-col cols="12" md="3">
              <CmProvinciaSelect
                v-model="form.prov"
                :country="form.id_paese_iso"
                :mode="geo.provinceMode.value"
                :province-items="geo.provinceItems.value"
                :label="t(geo.provinceLabelKey(form.id_paese_iso ?? ''))"
              />
            </v-col>
          </v-row>
        </div>

        <!-- ═══ Facturación ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiFileDocumentOutline" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_fatturazione') }}
          </div>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.PEC"
                :label="t('anagrafiche.fields.pec')"
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.cod_destin"
                v-field-help="'cod_destin'"
                :label="t('anagrafiche.fields.codice_destinatario')"
                density="compact"
                variant="outlined"
                :disabled="form.id_paese_iso !== 'IT'"
              />
            </v-col>
          </v-row>
        </div>

        <!-- ═══ Contacto ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiAccountOutline" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_contatto') }}
          </div>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.nome_from" v-field-help="'nome_from'" :label="t('anagrafiche.sede.nome_from')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.tel" :label="t('anagrafiche.fields.tel')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.fax" v-field-help="'fax'" :label="t('anagrafiche.fields.fax')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.mail" v-field-help="'mail'" :label="t('anagrafiche.fields.mail')" type="email" density="compact" variant="outlined" />
            </v-col>
          </v-row>
        </div>

        <!-- ═══ Terminales cargo ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiAirplane" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_terminali') }}
          </div>
          <v-row dense>
            <v-col cols="12" md="6">
              <CmTerminalSelect v-model="form.dhl_airport" :country="form.id_paese_iso" type="A" :label="t('anagrafiche.sede.dhl_airport')" />
            </v-col>
            <v-col cols="12" md="6">
              <CmTerminalSelect v-model="form.cargo_airport" v-field-help="'cargo_airport'" :country="form.id_paese_iso" type="A" :label="t('anagrafiche.sede.cargo_airport')" />
            </v-col>
            <!-- Campo "Puerto marítimo" (cargo_porto, type=P) eliminado: la tabla
                 cargo_terminals tiene 0 puertos y la columna cargo_porto nunca se
                 puebla; el form legacy de sede tampoco lo tiene. -->
          </v-row>
        </div>

        <!-- ═══ Logística (recogida / entrega) ═══ -->
        <div class="cm-sede-section">
          <div class="cm-sede-subhead">
            <v-icon :icon="mdiTruckOutline" size="16" class="mr-1" />
            {{ t('anagrafiche.sede.sec_logistica') }}
          </div>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.id_autista"
                v-field-help="'id_autista'"
                :items="autistiItems"
                :loading="loadingAutisti"
                :label="t('anagrafiche.sede.id_autista')"
                item-title="label"
                item-value="value"
                clearable
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.id_autista_cons"
                v-field-help="'id_autista_cons'"
                :items="autistiItems"
                :loading="loadingAutisti"
                :label="t('anagrafiche.sede.id_autista_cons')"
                item-title="label"
                item-value="value"
                clearable
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.presa_ora" v-field-help="'presa_ora'" type="time" :label="t('anagrafiche.sede.presa_ora')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.presa_limite" v-field-help="'presa_limite'" type="time" :label="t('anagrafiche.sede.presa_limite')" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.cons_ora" v-field-help="'cons_ora'" type="time" :label="t('anagrafiche.sede.cons_ora')" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <div class="cm-sede-switches">
            <v-switch v-model="form.presa_fissa" v-field-help="'presa_fissa'" :label="t('anagrafiche.sede.presa_fissa')" true-value="S" false-value="N" density="compact" hide-details color="primary" />
            <v-switch v-model="form.unisciprescons" v-field-help="'unisciprescons'" :label="t('anagrafiche.sede.unisciprescons')" true-value="S" false-value="N" density="compact" hide-details color="primary" />
            <v-switch v-model="form.logistica" v-field-help="'logistica'" :label="t('anagrafiche.sede.logistica')" true-value="S" false-value="N" density="compact" hide-details color="primary" />
            <v-switch v-model="form.ldv_corriere_sepresa" v-field-help="'ldv_corriere_sepresa'" :label="t('anagrafiche.sede.ldv_corriere_sepresa')" true-value="S" false-value="N" density="compact" hide-details color="primary" />
          </div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onClose">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SedeRow } from '../services/anagrafica.service';
import { sediInterneService } from '../services/sediInterne.service';
import { contattiService } from '../services/contatti.service';
import {
  mdiOfficeBuildingMarkerOutline,
  mdiMapMarkerOutline,
  mdiFileDocumentOutline,
  mdiAccountOutline,
  mdiAirplane,
  mdiTruckOutline,
} from '@mdi/js';
import { useToast } from '../composables/useToast';
import { useAddressGeo } from '../composables/useAddressGeo';
import CmCountrySelect from '../components/CmCountrySelect.vue';
import CmTerminalSelect from '../components/CmTerminalSelect.vue';
import CmProvinciaSelect from '../components/CmProvinciaSelect.vue';
import CmCapField from '../components/CmCapField.vue';
import CmCittaField from '../components/CmCittaField.vue';

const props = defineProps<{ modelValue: boolean; idAnagrafica: number; sede: SedeRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();
const { t } = useI18n();
const toast = useToast();

const saving = ref(false);
const form = ref<Partial<SedeRow>>({});

// Orquestación de dirección (provincia/ciudad/CAP dependientes del país).
const geo = useAddressGeo(computed(() => (form.value.id_paese_iso as string) ?? ''));

/** Rellena provincia y ciudad tras resolver el CAP, sin sobrescribir lo tecleado. */
function onCapResolved(r: { provShort: string | null; cities: string[] }): void {
  if (!form.value.prov && r.provShort) form.value.prov = r.provShort;
  if (!form.value.citta && r.cities.length === 1) form.value.citta = r.cities[0];
}

// Autisti (contatti tipo "Autista interno") para los selects de chofer.
const autistiItems = ref<{ title: string; label: string; value: number }[]>([]);
const loadingAutisti = ref(false);

async function loadAutisti(): Promise<void> {
  if (autistiItems.value.length > 0) return; // cachea entre aperturas
  loadingAutisti.value = true;
  try {
    const list = await contattiService.autisti(props.idAnagrafica);
    autistiItems.value = list.map((a) => {
      const label = String(a.nome ?? a.loginn ?? a.id);
      return { title: label, label, value: Number(a.id) };
    });
  } finally {
    loadingAutisti.value = false;
  }
}

const isEdit = computed(() => !!props.sede?.id);

const SN_DEFAULTS = ['presa_fissa', 'unisciprescons', 'logistica', 'ldv_corriere_sepresa'] as const;

watch(() => props.modelValue, (v) => {
  if (v) {
    const base = props.sede ? { ...props.sede } : {};
    // los v-switch S/N necesitan 'S'|'N', nunca null/undefined
    for (const k of SN_DEFAULTS) {
      (base as Record<string, unknown>)[k] = (base as Record<string, unknown>)[k] === 'S' ? 'S' : 'N';
    }
    form.value = base;
    void loadAutisti();
  }
});

function onClose(): void {
  emit('update:modelValue', false);
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    if (isEdit.value && form.value.id) {
      await sediInterneService.update(form.value.id, form.value);
    } else {
      await sediInterneService.create(props.idAnagrafica, form.value);
    }
    toast.success(t('anagrafiche.updated'));
    emit('saved');
    onClose();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cm-sede-body {
  padding-top: 8px;
}
/* Cada sección con separación clara y un encabezado que ayuda a ubicarse. */
.cm-sede-section {
  margin-bottom: 20px;
}
.cm-sede-section:last-child {
  margin-bottom: 0;
}
.cm-sede-subhead {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--v-theme-primary));
  padding-bottom: 6px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.5);
}
/* Switches en fila fluida, alineados y con buen respiro. */
.cm-sede-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin-top: 8px;
}
</style>
