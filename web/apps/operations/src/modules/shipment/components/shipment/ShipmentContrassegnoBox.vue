<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-cash" class="me-2" />
      {{ t("shipment.modals.cod.box_title") }}
      <v-chip
        v-if="active"
        size="small"
        color="info"
        variant="tonal"
        class="ms-2"
      >
        € {{ imp.local }}
      </v-chip>
    </v-card-title>

    <component :is="textWrapper">
      <!-- Importo: quanto si incassa (importe + divisa). Legacy has no COD
           currency selector; kept here as a convenience for international COD. -->
      <FormSection
        :title="t('shipment.modals.cod.section_amount')"
        icon="mdi-cash"
        flat
      >
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="imp.local"
              :label="t('shipment.modals.cod.amount')"
              type="number"
              min="0"
              step="0.01"
              prefix="€"
              :readonly="readonly('contras_imp')"
              @blur="imp.commit"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="valuta.local"
              :label="t('shipment.modals.cod.currency')"
              :items="currencyItems"
              :loading="currencyLoading"
              auto-select-first
              :readonly="readonly('id_valuta_contras')"
              @update:model-value="valuta.commit"
            />
          </v-col>
        </v-row>
      </FormSection>

      <!-- Incasso: stato + data (parity with legacy box `contrz`). -->
      <FormSection
        :title="t('shipment.modals.cod.section_collection')"
        icon="mdi-cash-check"
        flat
        last
      >
        <v-row dense>
          <v-col cols="12" md="6">
            <v-select
              v-model="incasso.local"
              :items="incassoItems"
              :label="t('shipment.modals.cod.cashed_in')"
              :readonly="readonly('contras_incasso')"
              @update:model-value="incasso.commit"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="dataInc.local"
              :label="t('shipment.modals.cod.cashed_in_date')"
              type="date"
              :readonly="readonly('contras_data_inc')"
              @blur="dataInc.commit"
            />
          </v-col>
        </v-row>
      </FormSection>
      <!-- Removed vs modern (legacy parity):
            - id_contrassegno: not a field in the legacy COD form at all.
            - contras_id_report: internal system value (FK to docsstory, the
              generated payment report); legacy shows it only as a read-only
              link, never as an editable input. -->
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { useCurrencyFieldBinding } from "@shipment/composables/useCurrencyFieldBinding";
import { currencyService } from "@shipment/services/currency.service";
import { VCard, VCardText } from "vuetify/components";
import FormSection from "@shared/ui/FormSection.vue";

const props = defineProps<{ embedded?: boolean }>();

const { t } = useI18n();

const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const imp = useFieldBinding("contras_imp", "0");
const incasso = useFieldBinding("contras_incasso", "N");
const dataInc = useFieldBinding("contras_data_inc", "");
// id_valuta_contras es int FK: lee la sigla resuelta (contras_valuta), escribe
// la sigla en id_valuta_contras (el backend la traduce a valute.id). Antes se
// leía el id crudo y se persistía la sigla → columna a 0.
const valuta = useCurrencyFieldBinding(
  "contras_valuta",
  "id_valuta_contras",
  "EUR",
);

const active = computed(() => Number(imp.local) > 0);

// El autocomplete muestra siglas ISO (day-rate table), igual que Insurance/
// Customs. La columna id_valuta_contras es int FK; el backend resuelve la sigla.
const currencyItems = ref<string[]>(["EUR"]);
const currencyLoading = ref(false);
onMounted(async () => {
  currencyLoading.value = true;
  try {
    const day = await currencyService.getDayRates();
    const sigle =
      day?.success && day.data ? day.data.rates.map((r) => r.sigla) : [];
    currencyItems.value = Array.from(
      new Set(["EUR", ...sigle.filter((s) => s && s !== "EUR")]),
    );
  } catch {
    currencyItems.value = ["EUR"];
  } finally {
    currencyLoading.value = false;
  }
});

// Estado de cobro del contrassegno (spedizioni.contras_incasso). Dominio real
// del enum (legacy pll_contras_incasso): 0/N/C/AB1/B/AB2/AC/CLC — NO S/N. El
// dominio anterior {N,S} persistía 'S', que no es miembro del enum → MariaDB
// lo truncaba a ''. Se conserva el orden y las descripciones del legacy
// (shipment.cod.incasso.opt_*). Se muestra SOLO la descripción legible (como el
// legacy <select>), no el código técnico; fallback al código si faltara la clave.
const INCASSO_CODES = ["0", "N", "C", "AB1", "B", "AB2", "AC", "CLC"] as const;
const incassoItems = computed(() =>
  INCASSO_CODES.map((code) => {
    const key = `shipment.cod.incasso.opt_${code}`;
    const label = t(key);
    return { title: label === key ? code : label, value: code };
  }),
);

// When embedded inside a v-expansion-panel, skip the card border so the
// expansion frame is the only chrome.
const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>
