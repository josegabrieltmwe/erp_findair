<template>
  <ModalWrapper
    name="insurance"
    :title="t('shipment.modals.insurance.title')"
    icon="mdi-shield-check-outline"
    :max-width="640"
  >
    <ShipmentInsuranceBox embedded />
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import ModalWrapper from "./ModalWrapper.vue";
import ShipmentInsuranceBox from "@shipment/components/shipment/ShipmentInsuranceBox.vue";

const { t } = useI18n();
</script>
