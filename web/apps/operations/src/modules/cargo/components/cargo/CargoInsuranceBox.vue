<template>
  <component :is="wrapper" v-bind="wrapperProps">
    <v-card-title
      v-if="!embedded"
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-shield-check-outline" size="18" class="me-2" />
      {{ t("cargo.insurance.title") }}
      <v-chip
        v-if="active"
        size="x-small"
        color="info"
        variant="tonal"
        class="ms-2"
      >
        {{ imp.local }} {{ valuta.local }}
      </v-chip>
    </v-card-title>
    <v-divider v-if="!embedded" />
    <component :is="textWrapper">
      <v-row dense>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="imp.local"
            :label="t('cargo.customs.declared_value')"
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
            :label="t('cargo.customs.currency_iso')"
            :items="currencyItems"
            :loading="currencyLoading"
            auto-select-first
            :readonly="readonly('id_valuta_assic')"
            @update:model-value="valuta.commit"
          />
        </v-col>
      </v-row>
    </component>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";
import { currencyService } from "@cargo/services/currency.service";
import { VCard, VCardText } from "vuetify/components";

const { t } = useI18n();
const props = defineProps<{ embedded?: boolean }>();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

const imp = useFieldBinding("assicuraz_imp", "0", { numeric: true });
// Insurance currency is stored as a raw sigla (no amount conversion, legacy
// parity). The picker is populated from the day-rate table (api_currency_day).
const valuta = useFieldBinding("id_valuta_assic", "EUR");
const active = computed(() => Number(imp.local) > 0);

const currencyItems = ref<string[]>(["EUR"]);
const currencyLoading = ref(false);
onMounted(async () => {
  currencyLoading.value = true;
  try {
    const day = await currencyService.getDayRates();
    const sigle =
      day?.success && day.data ? day.data.rates.map((r) => r.sigla) : [];
    const all = ["EUR", ...sigle.filter((s) => s && s !== "EUR")];
    currencyItems.value = Array.from(new Set(all));
  } catch {
    currencyItems.value = ["EUR"];
  } finally {
    currencyLoading.value = false;
  }
});

const wrapper = computed(() => (props.embedded ? "div" : VCard));
const wrapperProps = computed(() =>
  props.embedded ? {} : { border: true, rounded: "lg" as const },
);
const textWrapper = computed(() => (props.embedded ? "div" : VCardText));
</script>
