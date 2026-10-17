<template>
  <v-card border rounded="lg">
    <v-card-title class="d-flex align-center"
      ><v-icon icon="mdi-clipboard-check-outline" class="me-2" />
      {{ t("shipment.checkforn.title") }}
      <v-spacer />
      <v-btn
        size="small"
        variant="outlined"
        prepend-icon="$cog"
        :disabled="!id"
        @click="$emit('openSubcontracting')"
      >
        {{ t("shipment.checkforn.subcontracting") }}
      </v-btn>
    </v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="6">
          <v-select
            v-model="checkforn.local"
            :items="items"
            :label="t('shipment.checkforn.checkforn')"
            @update:model-value="checkforn.commit"
          />
        </v-col>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="fattureP.local"
            :label="t('shipment.checkforn.supplier_invoice_id')"
            type="number"
            :readonly="true"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useFieldBinding } from "@shipment/composables/useFieldBinding";

defineEmits<{ (e: "openSubcontracting"): void }>();

const { t } = useI18n();
const store = useShipmentStore();
const { id } = storeToRefs(store);

const checkforn = useFieldBinding("checkforn", "");
const fattureP = useFieldBinding("id_fattura_p", "0");

// Full legacy domain (spedizioni.checkforn enum O/V/K/X/R/A, order from
// spedy_array.php $pll_checkforn). The previous list used an invalid 'D'
// value and was missing O/K/R/A.
const items = computed(() => [
  { title: t("shipment.checkforn.opt_o"), value: "O" },
  { title: t("shipment.checkforn.opt_v"), value: "V" },
  { title: t("shipment.checkforn.opt_k"), value: "K" },
  { title: t("shipment.checkforn.opt_x"), value: "X" },
  { title: t("shipment.checkforn.opt_r"), value: "R" },
  { title: t("shipment.checkforn.opt_a"), value: "A" },
]);
</script>
