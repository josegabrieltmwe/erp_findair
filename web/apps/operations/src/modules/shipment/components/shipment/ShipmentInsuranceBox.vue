<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-shield-check-outline" class="me-2" />
      {{ t("shipment.modals.insurance.box_title") }}
      <v-chip
        v-if="active"
        size="small"
        color="info"
        variant="tonal"
        class="ms-2"
      >
        {{ formatMoney(imp.local, valuta.local) }}
      </v-chip>
    </v-card-title>

    <component :is="textWrapper">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="imp.local"
            :label="t('shipment.modals.insurance.declared_value')"
            type="number"
            min="0"
            step="0.01"
            :readonly="readonly('assicuraz_imp')"
            @blur="imp.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-autocomplete
            v-model="valuta.local"
            :label="t('shipment.modals.insurance.currency_iso')"
            :items="currencyItems"
            :loading="currencyLoading"
            auto-select-first
            :readonly="readonly('id_valuta_assic')"
            @update:model-value="valuta.commit"
          />
        </v-col>
        <!-- Campos ass_minimo_client/partner eliminados: NO son columnas de
             spedizioni. Son alias de lectura de anagrafiche.ass_minimo (umbral
             mínimo de seguro por cliente/partner), configuración comercial de la
             anagrafica, no editable por expedición. Persistirlos se descartaba. -->
      </v-row>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";
import { currencyService } from "@shipment/services/currency.service";
import { formatMoney } from "@shipment/utils/currency";
import { VCard, VCardText } from "vuetify/components";

const props = defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const imp = useFieldBinding("assicuraz_imp", "0");
// Insurance currency is a raw sigla (no amount conversion, legacy parity).
// Picker populated from the day-rate table (api_currency_day).
const valuta = useFieldBinding("id_valuta_assic", "EUR");

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

// Sprint D8 — minimum-insurance thresholds. Admin/operative only —
// useShipmentState::readonly() takes care of hiding edit access for
// roles that don't have it.

const active = computed(() => Number(imp.local) > 0);

const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>
