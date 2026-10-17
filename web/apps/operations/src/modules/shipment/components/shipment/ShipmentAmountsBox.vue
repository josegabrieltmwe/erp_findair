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
      <v-icon icon="mdi-cash-multiple" class="me-2" size="18" />
      {{ t("shipment.modals.costi.box_title") }}
      <v-card-subtitle class="pa-0 ms-2 text-caption text-medium-emphasis">
        {{ t("shipment.modals.costi.box_sub") }}
      </v-card-subtitle>
      <v-spacer />
      <v-btn
        size="x-small"
        variant="text"
        icon="mdi-currency-eur"
        :title="t('shipment.modals.currency.title')"
        @click="ui.openModal('currency_day')"
      />
      <v-chip
        size="x-small"
        variant="tonal"
        class="ms-1"
        :title="curr.name.value"
      >
        {{ prefix }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />
    <component
      :is="embedded ? 'div' : VCardText"
      :class="embedded ? '' : 'pa-3 box-maxw'"
    >
      <!-- CLIENTE: carico + fuel + candado (legacy fila 1, carico_lk). -->
      <FormSection
        :title="t('shipment.modals.costi.section_client')"
        icon="mdi-account-cash-outline"
        flat
      >
        <template #actions>
          <!-- Moneda de visualización (importes convertidos target↔EUR). El chip
               muestra la sigla; el botón abre el cambio del día. Integrado en la
               cabecera de la sección en vez de una barra suelta arriba. -->
          <v-tooltip location="top" :text="curr.name.value">
            <template #activator="{ props: tip }">
              <v-chip v-bind="tip" size="x-small" variant="tonal" class="me-1">
                {{ prefix }}
              </v-chip>
            </template>
          </v-tooltip>
          <v-tooltip location="top" :text="t('shipment.modals.currency.title')">
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                size="small"
                variant="text"
                icon="mdi-currency-eur"
                @click="ui.openModal('currency_day')"
              />
            </template>
          </v-tooltip>
          <!-- Candado carico_lk: cerrado (S) = importe fijado a mano, el motor
               de tarifas NO lo recalcula; abierto (N) = el rating lo sobrescribe. -->
          <v-tooltip
            location="top"
            :text="t('shipment.modals.costi.lock_hint')"
          >
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                size="small"
                variant="text"
                :icon="caricoLk ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
                :color="caricoLk ? 'primary' : undefined"
                :disabled="readonly('carico')"
                @click="toggleCaricoLk"
              />
            </template>
          </v-tooltip>
        </template>
        <v-row dense>
          <v-col cols="6" md="6">
            <FieldHelpTooltip :text="fieldHelp.helpText('carico')">
              <v-text-field
                v-model="carico.local"
                :label="t('shipment.modals.costi.carico')"
                type="number"
                min="0"
                step="0.01"
                density="compact"
                hide-details
                :prefix="prefix"
                :readonly="readonly('carico')"
                @blur="carico.commit"
              >
                <template #append-inner>
                  <FieldHistoryPopover
                    :label="t('shipment.modals.costi.carico')"
                    :fetcher="histFetcher('carico')"
                  />
                </template>
              </v-text-field>
            </FieldHelpTooltip>
          </v-col>
          <v-col cols="6" md="6">
            <FieldHelpTooltip :text="fieldHelp.helpText('fuel_surc')">
              <v-text-field
                v-model="fuelSurc.local"
                :label="t('shipment.modals.costi.fuel_surcharge')"
                type="number"
                min="0"
                step="0.01"
                density="compact"
                hide-details
                :prefix="prefix"
                :readonly="readonly('fuel_surc')"
                @blur="fuelSurc.commit"
              >
                <template #append-inner>
                  <FieldHistoryPopover
                    :label="t('shipment.modals.costi.fuel_surcharge')"
                    :fetcher="histFetcher('fuel_surc')"
                  />
                </template>
              </v-text-field>
            </FieldHelpTooltip>
          </v-col>
        </v-row>
      </FormSection>

      <!-- PROVEEDOR: costo previsto + fuel + costo real + candado. -->
      <FormSection
        :title="t('shipment.modals.costi.section_supplier')"
        icon="mdi-truck-cargo-container"
        flat
      >
        <template #actions>
          <v-tooltip
            location="top"
            :text="t('shipment.modals.costi.lock_hint')"
          >
            <template #activator="{ props: tip }">
              <v-btn
                v-bind="tip"
                size="small"
                variant="text"
                :icon="costoLk ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
                :color="costoLk ? 'primary' : undefined"
                :disabled="readonly('costo')"
                @click="toggleCostoLk"
              />
            </template>
          </v-tooltip>
        </template>
        <v-row dense>
          <v-col cols="6" md="4">
            <FieldHelpTooltip :text="fieldHelp.helpText('costo_previsto')">
              <v-text-field
                v-model="costo.local"
                :label="t('shipment.modals.costi.forecast_cost')"
                type="number"
                min="0"
                step="0.01"
                density="compact"
                hide-details
                :prefix="prefix"
                :readonly="readonly('costo')"
                @blur="costo.commit"
              >
                <template #append-inner>
                  <FieldHistoryPopover
                    :label="t('shipment.modals.costi.forecast_cost')"
                    :fetcher="histFetcher('costo_previsto')"
                  />
                </template>
              </v-text-field>
            </FieldHelpTooltip>
          </v-col>
          <v-col cols="6" md="4">
            <FieldHelpTooltip :text="fieldHelp.helpText('fuel_surc_cst')">
              <v-text-field
                v-model="fuelSurcCst.local"
                :label="t('shipment.modals.costi.fuel_coef')"
                type="number"
                min="0"
                step="0.0001"
                density="compact"
                hide-details
                :prefix="prefix"
                :readonly="readonly('fuel_surc_cst')"
                @blur="fuelSurcCst.commit"
              >
                <template #append-inner>
                  <FieldHistoryPopover
                    :label="t('shipment.modals.costi.fuel_coef')"
                    :fetcher="histFetcher('fuel_surc_cst')"
                  />
                </template>
              </v-text-field>
            </FieldHelpTooltip>
          </v-col>
          <v-col cols="6" md="4">
            <v-text-field
              v-model="costor.local"
              :label="t('shipment.modals.costi.real_cost')"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              hide-details
              :prefix="prefix"
              :readonly="readonly('costo_reale')"
              @blur="costor.commit"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Margen (utile) + administrativo (facturación, giacenza). -->
      <FormSection
        :title="t('shipment.modals.costi.section_margin')"
        icon="mdi-chart-line"
        flat
        last
      >
        <!-- Margine: carico − costo previsto (readonly, legacy utile_p). -->
        <div class="margin-strip mb-3">
          <span class="text-caption text-medium-emphasis">
            {{ t("shipment.modals.costi.margin") }}
          </span>
          <span class="margin-strip__value" :class="marginClass">
            {{ prefix }} {{ margin.toFixed(2) }}
            <span v-if="marginPct !== null" class="text-caption ms-1">
              · {{ marginPct.toFixed(1) }}%
            </span>
          </span>
        </div>
        <v-row dense>
          <v-col cols="12" md="6">
            <!-- controllo_fatt es enum('0','OK','NO','CA') — control de acción
                 de facturación (no un importe), separado de los montos. -->
            <v-select
              v-model="controlloFatt.local"
              :items="controlloFattItems"
              :label="t('shipment.modals.costi.invoice_check')"
              density="compact"
              :readonly="readonly('controllo_fatt')"
              @update:model-value="controlloFatt.commit"
            />
          </v-col>
          <v-col cols="12" md="6">
            <!-- giac_ricons: reconciliación de giacenza (F3.3 — editable en
                 modern; legacy la mostraba readonly (ro="div") porque solo la
                 pantalla de almacén podía tocarla). Ya está en la whitelist
                 backend (Shipment_Constants.php:111), sin recálculo asociado. -->
            <FieldHelpTooltip
              :text="t('shipment.modals.costi.giac_ricons_hint')"
            >
              <v-text-field
                v-model="giacRicons.local"
                :label="t('shipment.modals.costi.giac_ricons')"
                type="number"
                step="0.01"
                density="compact"
                hide-details
                :prefix="prefix"
                :readonly="readonly('giac_ricons')"
                @blur="giacRicons.commit"
              />
            </FieldHelpTooltip>
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <!-- acc_fermo_deposito: fermo deposito (hold at depot). Dispara
                 recálculo (Shipment_Constants::RECALC_TRIGGER_FIELDS:194). -->
            <v-checkbox
              v-model="accFermoDeposito"
              :label="t('shipment.modals.costi.fermo_deposito')"
              :disabled="readonly('acc_fermo_deposito')"
              density="compact"
              hide-details
              @update:model-value="commitFermoDeposito"
            />
          </v-col>
        </v-row>
      </FormSection>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { VCard, VCardText } from "vuetify/components";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { useTargetCurrency } from "@shipment/composables/useTargetCurrency";
import { useMoneyFieldBinding } from "@shipment/composables/useMoneyFieldBinding";
import { shipmentAuditService } from "@shipment/services/shipment_drawers.service";
import { useFieldHelp } from "@shipment/composables/useFieldHelp";
import FieldHistoryPopover from "@shared/detail/FieldHistoryPopover.vue";
import FormSection from "@shared/ui/FormSection.vue";
import FieldHelpTooltip from "@shared/ui/FieldHelpTooltip.vue";

defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const ui = useUiStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

// Per-field inline help (legacy itxt.php, express form id '31'). Same shared
// implementation as cargo; helpText() returns '' until the map loads, so the
// hint slot stays empty rather than flashing a key.
const fieldHelp = useFieldHelp();
fieldHelp.load();

// Per-field modification history (legacy spedy_form_show_xlog / ShowXLog).
const histFetcher = (campo: string) => () =>
  shipmentAuditService.fieldHistory(Number(shipment.value?.id ?? 0), campo);

// Target-currency layer: the 4 courier money amounts are stored in EUR but
// shown/entered in the client's target currency (legacy parity). Same shared
// implementation as cargo.
const curr = useTargetCurrency();
const sigla = () => curr.sigla.value;
const prefix = computed(() => curr.sigla.value || "EUR");

// `costo` is the SPA alias → backend resolves it to the costo_previsto column.
const carico = useMoneyFieldBinding("carico", curr.toDisplay, sigla);
const fuelSurc = useMoneyFieldBinding("fuel_surc", curr.toDisplay, sigla);
const costo = useMoneyFieldBinding("costo", curr.toDisplay, sigla);
const fuelSurcCst = useMoneyFieldBinding(
  "fuel_surc_cst",
  curr.toDisplay,
  sigla,
);

// Not converted: real cost, invoice-check flag, giacenza reconciliation.
const costor = useFieldBinding("costor", "0");
const controlloFatt = useFieldBinding("controllo_fatt", "");
const giacRicons = useFieldBinding("giac_ricons", "0");

// F3.3: fermo deposito (hold at depot) — S/N checkbox, same pattern as the
// other flag checkboxes (ShipmentFlagsBox). Kept local here since it triggers
// pricing recalculation and belongs next to giac_ricons in the admin section.
const accFermoDeposito = ref(false);
watch(
  shipment,
  (s) => {
    accFermoDeposito.value = s?.acc_fermo_deposito === "S";
  },
  { immediate: true },
);
async function commitFermoDeposito(v: boolean | null): Promise<void> {
  await store.update({ acc_fermo_deposito: v ? "S" : "N" });
}

// Price locks (legacy carico_lk / costo_previsto_lk, enum S/N). Closed (S) =
// the amount is pinned by hand and the pricing engine will NOT overwrite it on
// recalc; open (N) = the rating recomputes it. usePricingRecalc already honours
// both locks (skips when both are 'S'). We commit the toggle immediately so the
// lock state is buffered in the draft like every other field.
const caricoLk = computed(() => shipment.value?.carico_lk === "S");
const costoLk = computed(() => shipment.value?.costo_previsto_lk === "S");
function toggleCaricoLk(): void {
  void store.update({ carico_lk: caricoLk.value ? "N" : "S" });
}
function toggleCostoLk(): void {
  void store.update({ costo_previsto_lk: costoLk.value ? "N" : "S" });
}

// Margin (legacy utile_p = carico − costo_previsto). Both are stored EUR; we
// read the raw shipment values (not the display-converted bindings) so the
// margin is currency-consistent. Read-only, computed.
const margin = computed(() => {
  // `costo` is the SPA alias of the costo_previsto column (see binding below).
  const carichi =
    (Number(shipment.value?.carico ?? 0) || 0) +
    (Number(shipment.value?.fuel_surc ?? 0) || 0);
  const costi =
    (Number(shipment.value?.costo ?? 0) || 0) +
    (Number(shipment.value?.fuel_surc_cst ?? 0) || 0);
  return carichi - costi;
});
const marginPct = computed<number | null>(() => {
  const carichi =
    (Number(shipment.value?.carico ?? 0) || 0) +
    (Number(shipment.value?.fuel_surc ?? 0) || 0);
  if (carichi <= 0) return null;
  return (margin.value / carichi) * 100;
});
const marginClass = computed(() =>
  margin.value < 0 ? "text-error" : "text-success",
);

// controllo_fatt es enum('0','OK','NO','CA'). Mismo dominio que el editor
// canónico (ShipmentPostInvoiceBox); '0'=no definido. Reutiliza las claves i18n.
const controlloFattItems = computed(() => [
  { title: t("shipment.modals.post_invoice.ctrl_not_set"), value: "0" },
  { title: t("shipment.modals.post_invoice.ctrl_no"), value: "NO" },
  { title: t("shipment.modals.post_invoice.ctrl_ca"), value: "CA" },
  { title: t("shipment.modals.post_invoice.ctrl_ok"), value: "OK" },
]);
</script>

<style scoped>
/* Cap width only in standalone (non-embedded) mode; the modal controls width
   when embedded. */
.box-maxw {
  max-width: 920px;
}
/* Margin (utile) read-only summary strip. Tinte según el signo del margen,
   armonizado con la banda de margen del card de costes (CostiCard). */
.margin-strip {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.2);
}
.margin-strip__value {
  font-size: 1.1rem;
  font-weight: 700;
}
.margin-strip:has(.text-success) {
  background: rgba(var(--v-theme-success), 0.08);
  border-left-color: rgb(var(--v-theme-success));
}
.margin-strip:has(.text-error) {
  background: rgba(var(--v-theme-error), 0.08);
  border-left-color: rgb(var(--v-theme-error));
}
</style>
