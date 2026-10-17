<template>
  <ModalWrapper
    name="cod"
    :title="t('shipment.modals.cod.title')"
    icon="mdi-currency-eur"
    :max-width="640"
  >
    <ShipmentContrassegnoBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentContrassegnoBox from "@shipment/components/shipment/ShipmentContrassegnoBox.vue";

const { t } = useI18n();
</script>
