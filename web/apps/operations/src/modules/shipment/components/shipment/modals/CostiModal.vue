<template>
  <ModalWrapper
    name="costi"
    :title="t('shipment.modals.costi.title')"
    icon="mdi-currency-eur"
    :max-width="720"
  >
    <ShipmentAmountsBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentAmountsBox from "@shipment/components/shipment/ShipmentAmountsBox.vue";

const { t } = useI18n();
</script>
