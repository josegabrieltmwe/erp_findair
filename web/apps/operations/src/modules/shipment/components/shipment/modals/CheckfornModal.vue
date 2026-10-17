<template>
  <ModalWrapper
    name="checkforn"
    :title="t('shipment.checkforn.title')"
    icon="mdi-truck-check-outline"
    size="md"
  >
    <!-- Control de la factura del proveedor + acceso a subcontratación.
         El box emite `openSubcontracting`; el dialog de subcontratación (que en
         V2 no estaba montado) se gestiona aquí con estado local. -->
    <ShipmentCheckfornBox @open-subcontracting="subcontractingOpen = true" />

    <ShipmentSubcontractingDialog
      v-model="subcontractingOpen"
      :shipment-id="shipmentId"
    />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentCheckfornBox from "@shipment/components/shipment/ShipmentCheckfornBox.vue";
import ShipmentSubcontractingDialog from "@shipment/components/shipment/ShipmentSubcontractingDialog.vue";

const { t } = useI18n();
const store = useShipmentStore();
const { id } = storeToRefs(store);

const subcontractingOpen = ref(false);
const shipmentId = computed<number | null>(() =>
  id.value ? Number(id.value) : null,
);
</script>
