<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-scale-balance" class="me-2" />
      {{ t("shipment.extra_weights.title") }}</v-card-title
    >
    <v-card-text>
      <v-row dense>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="pesoFornit.local"
            :label="t('shipment.extra_weights.supplier_weight')"
            type="number"
            min="0"
            step="0.1"
            @blur="pesoFornit.commit"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="pesoFornitReale.local"
            :label="t('shipment.extra_weights.supplier_real_weight')"
            type="number"
            min="0"
            step="0.1"
            :readonly="readonly('peso_fornit_reale')"
            @blur="pesoFornitReale.commit"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="pesoReale.local"
            :label="t('shipment.extra_weights.real_weight')"
            type="number"
            min="0"
            step="0.1"
            @blur="pesoReale.commit"
          />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field
            v-model="volumeCliente.local"
            :label="t('shipment.extra_weights.client_volume')"
            type="number"
            min="0"
            step="0.001"
            @blur="volumeCliente.commit"
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

const pesoFornit = useFieldBinding("peso_fornit", "0");
const pesoFornitReale = useFieldBinding("peso_fornit_reale", "0");
const pesoReale = useFieldBinding("peso_reale", "0");
const volumeCliente = useFieldBinding("volume_cliente", "0");
</script>
