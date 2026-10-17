<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-calendar-multiple" class="me-2" />
      {{ t("shipment.dates_box.title") }}</v-card-title
    >
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataSped0.local"
            :label="t('shipment.dates_box.created')"
            :readonly="readonly('data_sped0')"
            @blur="dataSped0.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataConsegnaPrevista.local"
            :label="t('shipment.dates_box.expected_delivery')"
            type="datetime-local"
            @blur="dataConsegnaPrevista.commit"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field
            v-model="dataCorriere.local"
            :label="t('shipment.dates_box.courier_date')"
            type="date"
            @blur="dataCorriere.commit"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useShipmentState } from "@shipment/composables/useShipmentState";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);
const { readonly } = useShipmentState(shipment);

const dataSped0 = useFieldBinding("data_sped0", "");
const dataConsegnaPrevista = useFieldBinding("data_consegna_prevista", "");
const dataCorriere = useFieldBinding("data_corriere", "");
</script>
