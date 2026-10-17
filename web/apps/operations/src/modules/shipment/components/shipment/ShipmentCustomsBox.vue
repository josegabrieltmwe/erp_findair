<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title v-if="!embedded" class="d-flex align-center">
      <v-icon icon="mdi-passport" class="me-2" />
      {{ t("shipment.modals.customs.box_title") }}
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
        <v-col cols="12" md="4">
          <v-text-field
            v-model="imp.local"
            :label="t('shipment.modals.customs.declared_value')"
            type="number"
            min="0"
            step="0.01"
            :readonly="readonly('dogana_imp')"
            @blur="imp.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <!-- id_valuta_dogana es un FK int a valute.id, pero por ergonomía el
               autocomplete emite la sigla ISO (como Insurance/Contras) y el
               backend la resuelve a id (normalize_cod). Antes era un text-field
               libre que persistía la sigla cruda → MariaDB la casteaba a 0. -->
          <v-autocomplete
            v-model="valuta.local"
            :label="t('shipment.modals.customs.currency_iso')"
            :items="currencyItems"
            :loading="currencyLoading"
            auto-select-first
            :readonly="readonly('id_valuta_dogana')"
            @update:model-value="valuta.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="contenuto.local"
            :label="t('shipment.modals.customs.content')"
            @blur="contenuto.commit"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="descri.local"
            :label="t('shipment.modals.customs.description')"
            rows="2"
            auto-grow
            :readonly="readonly('dogana_descri')"
            @blur="descri.commit"
          />
        </v-col>
        <!-- Legacy parity: the customs box holds ONLY dogana_imp,
             id_valuta_dogana and dogana_descri (spedy_form.php box `doganz`).
             Removed here:
              - AWB_id_forn: not a UI field in legacy at all — it is an internal
                consistency value (the fornitore id that owns the AWB, must equal
                id_fornitore); the backend sets/resets it, editing it corrupts it.
              - opz_par_doc: lives in the Packages box (already editable there).
             `contenuto` is kept as a convenience customs field.
             descr_ita/eng/spa/fra were already removed (tracking_pubblico cols). -->
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
import { useCurrencyFieldBinding } from "@shipment/composables/useCurrencyFieldBinding";
import { currencyService } from "@shipment/services/currency.service";
import { formatMoney } from "@shipment/utils/currency";
import { VCard, VCardText } from "vuetify/components";

const props = defineProps<{ embedded?: boolean }>();

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const imp = useFieldBinding("dogana_imp", "0");
// id_valuta_dogana es int FK: lee la sigla resuelta (dogana_valuta), escribe la
// sigla en id_valuta_dogana (el backend la traduce a valute.id).
const valuta = useCurrencyFieldBinding(
  "dogana_valuta",
  "id_valuta_dogana",
  "EUR",
);
const contenuto = useFieldBinding("contenuto", "");

// Divisas para el autocomplete de aduana (mismo origen que Insurance/Contras:
// tabla de cambios del día). El backend traduce la sigla al FK valute.id.
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
const descri = useFieldBinding("dogana_descri", "");

const active = computed(() => Number(imp.local) > 0);

const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>
