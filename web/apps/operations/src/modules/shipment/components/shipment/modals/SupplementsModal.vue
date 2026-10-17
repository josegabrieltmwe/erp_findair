<template>
  <ModalWrapper
    name="supplements"
    :title="t('shipment.modals.supplements.title')"
    icon="mdi-tag-plus-outline"
    :max-width="980"
  >
    <!--
      Dos ejes (paridad legacy supplz / fsupplz):
      · Cliente (delta='N'): un suplemento con SUS dos precios (coste fornitore
        fix_priceF + precio cliente fix_priceC) en la misma fila. Editable.
      · Courier / fornitore (delta='S'): SOLO activación (checkboxes), sin
        edición de precio — el precio del fornitore se calcula por listino, no
        se guarda por expedición. Son registros independientes en
        spedizioni_suppl (el backend ya los resuelve por delta).
    -->
    <v-tabs v-model="tab" density="compact" color="primary" class="mb-2">
      <v-tab value="client">{{
        t("shipment.modals.supplements.tab_client")
      }}</v-tab>
      <v-tab value="supplier">{{
        t("shipment.modals.supplements.tab_supplier")
      }}</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="client">
        <ShipmentSupplementsBox embedded />
      </v-window-item>
      <v-window-item value="supplier">
        <ShipmentSupplierSupplementsBox embedded />
      </v-window-item>
    </v-window>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentSupplementsBox from "@shipment/components/shipment/ShipmentSupplementsBox.vue";
import ShipmentSupplierSupplementsBox from "@shipment/components/shipment/ShipmentSupplierSupplementsBox.vue";

const { t } = useI18n();
const ui = useUiStore();
const tab = ref<"client" | "supplier">("client");
</script>
