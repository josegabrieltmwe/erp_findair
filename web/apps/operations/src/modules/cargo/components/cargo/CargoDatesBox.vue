<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-calendar-multiple" size="18" class="me-2" />
      {{ t("cargo.dates.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataSped0.local"
            :label="t('cargo.dates.created')"
            :readonly="readonly('data_sped0')"
            @blur="dataSped0.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataSped1.local"
            :label="t('cargo.dates.departure_date')"
            type="date"
            @blur="dataSped1.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataCorriere.local"
            :label="t('cargo.dates.courier_date')"
            type="date"
            @blur="dataCorriere.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="voloPart.local"
            :label="t('cargo.dates.flight_departure')"
            type="datetime-local"
            @blur="voloPart.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="voloArr.local"
            :label="t('cargo.dates.flight_arrival')"
            type="datetime-local"
            @blur="voloArr.commit"
          />
        </v-col>
        <v-col cols="12">
          <v-text-field
            v-model="dataConsegnaPrevista.local"
            :label="t('cargo.dates.expected_delivery')"
            type="datetime-local"
            @blur="dataConsegnaPrevista.commit"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoState } from "@cargo/composables/useCargoState";
import { useFieldBinding } from "@cargo/composables/useFieldBinding";

const { t } = useI18n();
const store = useCargoStore();
const { cargo } = storeToRefs(store);
const { readonly } = useCargoState(cargo);

const dataSped0 = useFieldBinding("data_sped0", "");
const dataSped1 = useFieldBinding("data_sped1", "");
const dataCorriere = useFieldBinding("data_corriere", "");
const voloPart = useFieldBinding("data_volo_partenza", "");
const voloArr = useFieldBinding("data_volo_arrivo", "");
const dataConsegnaPrevista = useFieldBinding("data_consegna_prevista", "");
</script>
