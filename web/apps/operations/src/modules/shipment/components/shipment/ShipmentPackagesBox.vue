<template>
  <!-- embedded: the host ModalWrapper already provides the dialog card + title. -->
  <component
    :is="embedded ? 'div' : VCard"
    v-bind="
      embedded
        ? {}
        : {
            border: true,
            rounded: 'lg',
            density: 'compact',
            class: 'box-compact',
          }
    "
  >
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-2"
    >
      <v-icon icon="mdi-package-variant" class="me-2" size="18" />
      {{ t("shipment.modals.colli.packages") }}
      <v-card-subtitle class="pa-0 ms-2 text-caption text-medium-emphasis">
        {{ t("shipment.modals.colli.packages_sub") }}
      </v-card-subtitle>
      <v-spacer />
      <v-btn-toggle
        v-model="metricSystem"
        mandatory
        density="compact"
        variant="outlined"
      >
        <v-btn value="M" size="x-small">kg</v-btn>
        <v-btn value="I" size="x-small">lb</v-btn>
      </v-btn-toggle>
    </v-card-title>
    <div v-else class="d-flex align-center mb-2">
      <v-spacer />
      <v-btn-toggle
        v-model="metricSystem"
        mandatory
        density="compact"
        variant="outlined"
      >
        <v-btn value="M" size="x-small">kg</v-btn>
        <v-btn value="I" size="x-small">lb</v-btn>
      </v-btn-toggle>
    </div>
    <v-divider v-if="!embedded" />
    <component
      :is="embedded ? 'div' : VCardText"
      :class="embedded ? '' : 'pa-3 box-maxw'"
    >
      <!-- Peso e misure: totali dichiarati -->
      <FormSection
        :title="t('shipment.modals.colli.section_totals')"
        icon="mdi-weight-kilogram"
        flat
      >
        <v-row dense>
          <v-col cols="6" md="4">
            <v-text-field
              v-model="colli.local"
              :label="t('shipment.modals.colli.pieces')"
              type="number"
              min="0"
              density="compact"
              :readonly="readonly('colli')"
              @blur="onColliBlur"
            />
          </v-col>
          <v-col cols="6" md="4">
            <v-text-field
              v-model="pesoDisplay"
              :label="
                t('shipment.modals.colli.weight', {
                  unit: metric.weightLabel.value,
                })
              "
              type="number"
              min="0"
              step="0.1"
              density="compact"
              :readonly="readonly('peso')"
              @blur="peso.commit"
            />
          </v-col>
          <v-col cols="6" md="4">
            <!-- Chargeable weight (peso_tassato) is READONLY — legacy parity
                 (spedy_form.php: $xcml["peso_tassato"]["ro"]="readonly"). It is
                 not a free field: the pricing engine computes it as
                 MAX(declared weight, volumetric weight, real weighed weight)
                 and writes it back. Editing it here would just be overwritten
                 on the next recalc, so we show it read-only with a hint. -->
            <!-- Not an input: a read-only "computed value" display so the
                 operator sees it is not editable (the pricing engine owns it). -->
            <FieldHelpTooltip
              :text="t('shipment.modals.colli.chargeable_help')"
            >
              <div class="chargeable-display">
                <span class="chargeable-display__label">
                  {{
                    t("shipment.modals.colli.chargeable", {
                      unit: metric.weightLabel.value,
                    })
                  }}
                </span>
                <span class="chargeable-display__value">
                  <v-icon
                    icon="mdi-calculator-variant-outline"
                    size="16"
                    class="me-1 text-medium-emphasis"
                  />
                  {{ pesoTassatoDisplay }}
                </span>
              </div>
            </FieldHelpTooltip>
          </v-col>
        </v-row>
      </FormSection>

      <!-- Classificazione e calcolo: tipo collo, km forzati -->
      <FormSection
        :title="t('shipment.modals.colli.section_classification')"
        icon="mdi-shape-outline"
        flat
      >
        <v-row dense>
          <!-- opz_par_doc shares the same visibility rule as ShipmentCustomsBox
               (legacy Opz_par_doc()): hidden on same-country / intra-EU routes,
               so the two editors of this field stay consistent. -->
          <v-col v-if="customsDoc.visible.value" cols="6" md="6">
            <v-select
              v-model="opzParDoc.local"
              :items="opzItems"
              :label="t('shipment.modals.colli.type')"
              density="compact"
              :readonly="readonly('opz_par_doc')"
              @update:model-value="opzParDoc.commit"
            />
          </v-col>
          <v-col cols="6" md="6">
            <v-text-field
              v-model="kmForza.local"
              :label="t('shipment.modals.colli.km_override')"
              type="number"
              min="0"
              density="compact"
              @blur="kmForza.commit"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Pesatura e deposito -->
      <FormSection
        :title="t('shipment.modals.colli.section_weighing')"
        icon="mdi-scale-balance"
        flat
        last
      >
        <v-row dense>
          <!-- Fissa corriere: legacy `acc_fissa_corriere` is an INT FK to a
               courier (anagrafiche scelta_forn BSI/BES), 0 = none — NOT a
               boolean. A dropdown keeps the courier id; a checkbox would
               corrupt it to S/N. -->
          <v-col cols="12" md="6">
            <v-select
              v-model="fissaCorriereModel"
              :items="fissaCorriereItems"
              :loading="fissaCorriereLoading"
              item-title="label"
              item-value="value"
              :label="t('shipment.modals.colli.fixed_courier')"
              :placeholder="t('common.select')"
              density="compact"
              clearable
              :readonly="readonly('acc_fissa_corriere')"
            />
          </v-col>

          <v-col cols="12" md="6" class="d-flex align-center">
            <v-checkbox
              v-model="fermoDeposito"
              density="compact"
              :label="t('shipment.modals.colli.hold_at_depot')"
              hide-details
              @update:model-value="commitFermo"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- REQ2: avviso (NON modifica nulla) quando il peso totale dichiarato
           non coincide con la somma dei pesi dei colli (tolleranza 0.01 kg). -->
      <v-alert
        v-if="weightMismatch"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        {{
          t("shipment.modals.colli.weight_mismatch", {
            total: totalDeclaredDisplay.toFixed(2),
            sum: rowsWeightDisplay.toFixed(2),
            unit: metric.weightLabel.value,
          })
        }}
      </v-alert>
    </component>
  </component>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard, VCardText } from "vuetify/components";
import FormSection from "@shared/ui/FormSection.vue";
import FieldHelpTooltip from "@shared/ui/FieldHelpTooltip.vue";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useCustomsDocVisibility } from "@shipment/composables/useCustomsDocVisibility";
import { useMetricImperial } from "@shipment/composables/useMetricImperial";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { selectableCarriersService } from "@shipment/services/selectable_carriers.service";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment, colliRows, metricDisplay } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);
// Same opz_par_doc visibility rule as ShipmentCustomsBox (legacy Opz_par_doc()).
const customsDoc = useCustomsDocVisibility(shipment);

// REQ4: the active display system is shared via the store so this header and
// the per-package list (ShipmentColliList) show consistent units. It is
// INITIALISED from the client's `metric_imperial` ('I' → imperial) and the
// toggle only overrides the local view — it is NEVER persisted to the
// shipment (the old `store.update({ metricsystem })` wrote to a non-existent
// column and has been removed). The DB always stores metric (kg/cm).
const metric = useMetricImperial(metricDisplay.value);
const metricSystem = computed({
  get: () => metricDisplay.value,
  set: (v: "M" | "I") => {
    metricDisplay.value = v;
    metric.setSystem(v);
  },
});

watch(
  () => shipment.value?.metric_imperial,
  (v) => {
    const sys: "M" | "I" = v === "I" ? "I" : "M";
    metricDisplay.value = sys;
    metric.setSystem(sys);
  },
  { immediate: true },
);

const colli = useFieldBinding("colli", "0");
const peso = useFieldBinding("peso", "0");
const pesoTassato = useFieldBinding("peso_tassato", "0");

// REQ4: weight fields are stored metric (kg) but shown in the active system.
// Display computeds read/write the field-binding `.local` (metric value),
// converting only at the UI boundary. Commit still writes the metric value.
const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 10000) / 10000;

const pesoDisplay = computed({
  get: () => String(round2(metric.toDisplayWeight(Number(peso.local) || 0))),
  set: (v: string) => {
    peso.local = String(round4(metric.fromDisplayWeight(Number(v) || 0)));
  },
});
// Read-only display of the chargeable weight (peso_tassato). The pricing
// engine owns this value, so there is no setter — the field is not editable.
const pesoTassatoDisplay = computed(() =>
  String(round2(metric.toDisplayWeight(Number(pesoTassato.local) || 0))),
);

// REQ1: colli (Pieces) ⇄ table rows, bidirectional, UI-only (no autosave).
// Mechanism chosen: shared store.colliRows is the single source of truth for
// the rows; here a computed mirrors store.shipment.colli. Setting colli resizes
// the rows (store.resizeColliRows) and pushes the count into the colli field
// binding (draft-buffered, persisted on Salva). A watcher on the rows length
// keeps colli in sync when the user adds/removes rows in the table. Legacy
// parity (spedy_update_funz.php): colli drives the spedizioni_colli rows.
let syncingColli = false;
watch(
  () => colliRows.value.length,
  (len) => {
    if (syncingColli || store.colliRowsHydrating) return;
    if (String(len) !== String(colli.local)) {
      syncingColli = true;
      colli.local = String(len) as typeof colli.local;
      void colli.commit();
      syncingColli = false;
    }
  },
);

function onColliBlur(): void {
  // colli is the source of truth: resize the shared rows to match, then commit
  // the colli field (draft-buffered). syncingColli prevents the rows-length
  // watcher from echoing back into colli during the resize.
  const n = Number(colli.local) || 0;
  if (n !== colliRows.value.length) {
    syncingColli = true;
    store.resizeColliRows(n);
    syncingColli = false;
  }
  void colli.commit();
}

// REQ2: warn (do NOT modify) when declared total weight ≠ Σ rows[].peso.
const rowsWeightMetric = computed(() =>
  colliRows.value.reduce((acc, r) => acc + (Number(r.peso) || 0), 0),
);
const declaredWeightMetric = computed(() => Number(peso.local) || 0);
const weightMismatch = computed(
  () => Math.abs(rowsWeightMetric.value - declaredWeightMetric.value) > 0.01,
);
const totalDeclaredDisplay = computed(() =>
  round2(metric.toDisplayWeight(declaredWeightMetric.value)),
);
const rowsWeightDisplay = computed(() =>
  round2(metric.toDisplayWeight(rowsWeightMetric.value)),
);
const opzParDoc = useFieldBinding("opz_par_doc", "");
const kmForza = useFieldBinding("km_forza", "0");

// Dominio legacy de opz_par_doc: '0'=no definido, 'P'=parcel, 'D'=documents.
// Antes faltaba la opción "no definido", divergente del editor de CustomsBox.
const opzItems = computed(() => [
  { title: t("shipment.modals.customs.opz_not_set"), value: "0" },
  { title: t("shipment.modals.colli.type_parcel"), value: "P" },
  { title: t("shipment.modals.colli.type_document"), value: "D" },
]);

// acc_fermo_deposito is a real S/N enum → checkbox.
const fermoDeposito = ref<boolean>(false);

// acc_fissa_corriere is an INT FK to a courier (anagrafiche scelta_forn
// BSI/BES), 0 = none. Legacy parity: a dropdown, NOT a boolean. Loaded once
// from the shared master lookup.
const fissaCorriere = ref<number>(0);
const fissaCorriereLoading = ref(false);
const fissaCorriereItems = ref<Array<{ value: number; label: string }>>([]);

// The v-select model maps 0 ⇄ null so "no courier" shows the placeholder
// ("Select") instead of the raw value "0" (0 is not a catalog item). Writing
// commits the int (null → 0 = none) to the shipment.
const fissaCorriereModel = computed<number | null>({
  get: () => (fissaCorriere.value > 0 ? fissaCorriere.value : null),
  set: (v) => {
    const id = Number(v ?? 0) || 0;
    fissaCorriere.value = id;
    void commitFissaCorriere(id);
  },
});

watch(
  shipment,
  (s) => {
    fermoDeposito.value = s?.acc_fermo_deposito === "S";
    fissaCorriere.value = Number(s?.acc_fissa_corriere ?? 0) || 0;
  },
  { immediate: true },
);

selectableCarriersService
  .list()
  .then((rows) => {
    fissaCorriereItems.value = rows.map((r) => ({
      value: r.id,
      label: r.label,
    }));
  })
  .catch(() => {
    // Silent: the field stays usable with the persisted value only.
  });

async function commitFermo(v: boolean | null): Promise<void> {
  await store.update({ acc_fermo_deposito: v ? "S" : "N" });
}
async function commitFissaCorriere(v: number | null): Promise<void> {
  // Clearing the select yields null → persist 0 (legacy "none").
  await store.update({ acc_fissa_corriere: v ?? 0 });
}
</script>

<style scoped>
/* Cap width only in standalone mode; the modal controls width when embedded. */
.box-maxw {
  max-width: 920px;
}

/* Read-only "computed value" display for the chargeable weight. Deliberately
   NOT styled like an outlined input (no border, muted surface) so it reads as
   a derived, non-editable value. Height matches the compact fields alongside. */
.chargeable-display {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 40px;
  padding: 4px 12px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.18);
}
.chargeable-display__label {
  font-size: 0.7rem;
  line-height: 1;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 2px;
}
.chargeable-display__value {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.87);
}
</style>
